import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";

export interface ImageAssetBriefOptions {
  post: string;
  outDir: string;
}

export interface ImageAssetBriefResult {
  outDir: string;
  files: {
    markdown: string;
    prompt: string;
    json: string;
  };
}

function parseArgs(argv: string[]): ImageAssetBriefOptions {
  const postArgIndex = argv.findIndex((arg) => arg === "--post");
  const outArgIndex = argv.findIndex((arg) => arg === "--out");

  return {
    post: postArgIndex >= 0 ? argv[postArgIndex + 1] : "latest",
    outDir: outArgIndex >= 0 ? argv[outArgIndex + 1] : ".tmp/image-assets"
  };
}

function renderImageAssetMarkdown(input: ReturnType<typeof createXhsPublishPackage>) {
  return [
    `# ${input.title} - 图片素材包`,
    "",
    `Post ID: ${input.postId}`,
    "",
    "## 封面文字",
    "",
    input.coverText,
    "",
    "## 图片 Brief",
    "",
    input.visualBrief,
    "",
    "## AI 出图 Prompt",
    "",
    input.imagePrompt,
    "",
    "## 图片建议",
    "",
    ...input.imageIdeas.map((idea) => `- ${idea}`),
    "",
    "## 素材清单",
    "",
    ...input.assetChecklist.map((item) => `- ${item}`),
    "",
    "## 上传命令",
    "",
    "```powershell",
    "npm.cmd run publish -- --post latest --images-dir .\\assets\\xhs",
    "```",
    ""
  ].join("\n");
}

export async function prepareImageAssetBrief(options: ImageAssetBriefOptions): Promise<ImageAssetBriefResult> {
  const post = options.post === "latest" ? await postStore.latestDraft() : await postStore.get(options.post);
  if (!post) {
    throw new Error("No post found. Generate or approve a draft first.");
  }

  const outDir = join(process.cwd(), options.outDir);
  await mkdir(outDir, { recursive: true });

  const publishPackage = createXhsPublishPackage(post);
  const markdownFile = "image-asset-brief.md";
  const promptFile = "image-prompt.txt";
  const jsonFile = "image-asset-brief.json";

  await writeFile(join(outDir, markdownFile), renderImageAssetMarkdown(publishPackage), "utf8");
  await writeFile(join(outDir, promptFile), `${publishPackage.imagePrompt}\n`, "utf8");
  await writeFile(
    join(outDir, jsonFile),
    `${JSON.stringify(
      {
        postId: publishPackage.postId,
        title: publishPackage.title,
        coverText: publishPackage.coverText,
        visualBrief: publishPackage.visualBrief,
        imagePrompt: publishPackage.imagePrompt,
        imageIdeas: publishPackage.imageIdeas,
        assetChecklist: publishPackage.assetChecklist,
        uploadCommand: "npm.cmd run publish -- --post latest --images-dir .\\assets\\xhs"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    outDir,
    files: {
      markdown: markdownFile,
      prompt: promptFile,
      json: jsonFile
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await prepareImageAssetBrief(parseArgs(process.argv.slice(2)));
    console.log(result.outDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
