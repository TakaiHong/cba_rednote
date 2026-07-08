import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";
import { runLogStore } from "../server/src/storage/runLogStore.js";

export interface CoverImageOptions {
  post: string;
  outDir: string;
  attach: boolean;
}

export interface CoverImageResult {
  postId: string;
  outputPath: string;
  attached: boolean;
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean) as string[];

export function resolveChromePath(candidates = chromeCandidates) {
  return candidates.find((candidate) => existsSync(candidate));
}

export function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 44);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderCoverHtml(input: {
  title: string;
  coverText: string;
  scene: string;
  imageIdea: string;
  tags: string[];
}) {
  const tags = input.tags.slice(0, 4).map((tag) => `#${tag.replace(/^#/, "")}`);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1080px;
      height: 1440px;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      background: #f7f3ea;
      color: #1d2527;
    }
    .cover {
      position: relative;
      width: 1080px;
      height: 1440px;
      overflow: hidden;
      padding: 92px 82px;
      background:
        linear-gradient(150deg, rgba(6, 101, 103, 0.18), transparent 42%),
        linear-gradient(30deg, rgba(218, 78, 52, 0.20), transparent 48%),
        #f7f3ea;
    }
    .badge {
      display: inline-block;
      padding: 18px 28px;
      border: 3px solid #1d2527;
      border-radius: 999px;
      background: #ffffff;
      font-size: 32px;
      font-weight: 700;
    }
    h1 {
      margin: 72px 0 30px;
      max-width: 860px;
      font-size: 92px;
      line-height: 1.04;
      letter-spacing: 0;
    }
    .scene {
      max-width: 820px;
      font-size: 38px;
      line-height: 1.38;
      color: #3c4648;
    }
    .visual {
      position: absolute;
      left: 82px;
      right: 82px;
      bottom: 210px;
      height: 330px;
      border: 4px solid #1d2527;
      border-radius: 28px;
      background: #ffffff;
      box-shadow: 18px 18px 0 #066567;
      padding: 44px;
    }
    .box-row {
      position: absolute;
      left: 48px;
      bottom: 44px;
      display: flex;
      align-items: flex-end;
      gap: 22px;
    }
    .box {
      width: 148px;
      height: 116px;
      border: 4px solid #1d2527;
      background: #d9b46f;
    }
    .box:nth-child(2) { height: 156px; background: #da4e34; }
    .box:nth-child(3) { height: 92px; background: #76b7ad; }
    .idea {
      position: absolute;
      right: 44px;
      top: 42px;
      width: 440px;
      font-size: 34px;
      line-height: 1.3;
      font-weight: 700;
    }
    .tags {
      position: absolute;
      left: 82px;
      right: 82px;
      bottom: 84px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 28px;
      font-weight: 700;
    }
    .tag {
      padding: 12px 18px;
      border-radius: 999px;
      background: #1d2527;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <main class="cover">
    <div class="badge">新加坡迷你仓</div>
    <h1>${escapeHtml(input.coverText || input.title)}</h1>
    <p class="scene">${escapeHtml(input.scene)}</p>
    <section class="visual">
      <div class="idea">${escapeHtml(input.imageIdea)}</div>
      <div class="box-row">
        <div class="box"></div>
        <div class="box"></div>
        <div class="box"></div>
      </div>
    </section>
    <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
  </main>
</body>
</html>`;
}

function parseArgs(argv: string[]): CoverImageOptions {
  const postIndex = argv.findIndex((arg) => arg === "--post");
  const outIndex = argv.findIndex((arg) => arg === "--out");
  return {
    post: postIndex >= 0 ? argv[postIndex + 1] : "latest",
    outDir: outIndex >= 0 ? argv[outIndex + 1] : ".tmp/generated-covers",
    attach: argv.includes("--attach")
  };
}

export async function generateCoverImage(options: CoverImageOptions): Promise<CoverImageResult> {
  const post = options.post === "latest" ? await postStore.latestDraft() : await postStore.get(options.post);
  if (!post) throw new Error("No post found. Generate or approve a draft first.");

  const chromePath = resolveChromePath();
  if (!chromePath) throw new Error("No Chrome executable found. Set CHROME_PATH to generate a cover image.");

  const publishPackage = createXhsPublishPackage(post);
  await mkdir(options.outDir, { recursive: true });
  const filename = `${post.createdAt.slice(0, 10)}-${safeFilename(post.title) || post.id}.png`;
  const outputPath = join(options.outDir, filename);
  const html = renderCoverHtml({
    title: publishPackage.title,
    coverText: publishPackage.coverText,
    scene: post.topic.scene,
    imageIdea: post.imageIdeas[0] ?? "行李、纸箱和干净迷你仓空间",
    tags: post.tags
  });

  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.screenshot({ path: outputPath, type: "png", fullPage: false });
  } finally {
    await browser.close();
  }

  if (options.attach) {
    const imageAssets = [...new Set([...(post.imageAssets ?? []), outputPath])];
    await postStore.update(post.id, { imageAssets });
  }

  await runLogStore.append({
    action: "image-cover",
    status: "ok",
    message: `Generated cover image for post ${post.id}`,
    metadata: {
      postId: post.id,
      outputPath,
      attached: options.attach
    }
  });

  return { postId: post.id, outputPath, attached: options.attach };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await generateCoverImage(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
