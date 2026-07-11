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
  const title = escapeHtml(input.coverText || input.title);
  const scene = escapeHtml(input.scene);
  const imageIdea = escapeHtml(input.imageIdea);

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
      background: #f2eadf;
      color: #17211f;
    }
    .cover {
      position: relative;
      width: 1080px;
      height: 1440px;
      overflow: hidden;
      padding: 74px 72px;
      background:
        linear-gradient(90deg, rgba(23, 33, 31, 0.06) 1px, transparent 1px),
        linear-gradient(0deg, rgba(23, 33, 31, 0.06) 1px, transparent 1px),
        #f2eadf;
      background-size: 48px 48px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 30px;
      font-weight: 900;
    }
    .brand,
    .price {
      padding: 14px 22px;
      border: 3px solid #17211f;
      border-radius: 999px;
      background: #fffdf8;
      box-shadow: 7px 7px 0 #dfb75d;
    }
    .price {
      background: #e15337;
      color: #fffdf8;
      box-shadow: 7px 7px 0 #17211f;
    }
    h1 {
      margin: 76px 0 20px;
      width: 900px;
      font-size: 104px;
      line-height: 1.02;
      letter-spacing: 0;
      font-weight: 900;
    }
    .scene {
      width: 820px;
      font-size: 38px;
      line-height: 1.34;
      font-weight: 700;
      color: #475451;
    }
    .board {
      position: absolute;
      left: 72px;
      right: 72px;
      bottom: 236px;
      height: 560px;
      border: 5px solid #17211f;
      border-radius: 34px;
      background: #fffdf8;
      box-shadow: 18px 18px 0 #1f6a62;
    }
    .tape {
      position: absolute;
      width: 172px;
      height: 58px;
      background: rgba(232, 196, 117, 0.78);
      border: 3px solid rgba(23, 33, 31, 0.55);
      transform: rotate(-8deg);
    }
    .tape.one { left: 76px; top: -28px; }
    .tape.two { right: 92px; top: -22px; transform: rotate(7deg); }
    .sticky {
      position: absolute;
      border: 4px solid #17211f;
      background: #ffe88c;
      box-shadow: 10px 10px 0 rgba(23, 33, 31, 0.14);
      padding: 30px;
      font-weight: 900;
    }
    .sticky.main {
      left: 58px;
      top: 64px;
      width: 462px;
      height: 330px;
      transform: rotate(-2deg);
      font-size: 78px;
      line-height: 1.03;
    }
    .sticky.side {
      right: 58px;
      top: 78px;
      width: 350px;
      height: 178px;
      background: #b9ded7;
      transform: rotate(3deg);
      font-size: 35px;
      line-height: 1.12;
    }
    .sticky.small {
      left: 130px;
      bottom: 54px;
      width: 295px;
      height: 136px;
      background: #ffd0c7;
      transform: rotate(2deg);
      font-size: 36px;
      line-height: 1.18;
    }
    .checklist {
      position: absolute;
      right: 62px;
      bottom: 46px;
      width: 392px;
      display: grid;
      gap: 16px;
    }
    .check {
      padding: 16px 20px;
      border: 4px solid #17211f;
      border-radius: 18px;
      background: #fffdf8;
      font-size: 34px;
      font-weight: 900;
    }
    .check:before {
      content: "✓";
      display: inline-block;
      margin-right: 12px;
      color: #1f6a62;
      font-weight: 900;
    }
    .tags {
      position: absolute;
      left: 82px;
      right: 82px;
      bottom: 60px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 27px;
      font-weight: 700;
    }
    .tag {
      padding: 12px 18px;
      border-radius: 999px;
      background: #17211f;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <main class="cover">
    <div class="top">
      <div class="brand">新加坡迷你仓</div>
      <div class="price">短租也划算</div>
    </div>
    <h1>${title}</h1>
    <p class="scene">${scene}</p>
    <section class="board">
      <div class="tape one"></div>
      <div class="tape two"></div>
      <div class="sticky main">东西没地方放？</div>
      <div class="sticky side">${imageIdea}</div>
      <div class="sticky small">回国 / 搬家 / 租房断档</div>
      <div class="checklist">
        <div class="check">便宜短租</div>
        <div class="check">自己运也行</div>
        <div class="check">需要可帮运</div>
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
