import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createXhsPublishPackage, renderXhsMarkdownExport } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";

const postArgIndex = process.argv.findIndex((arg) => arg === "--post");
const outArgIndex = process.argv.findIndex((arg) => arg === "--out");
const postArg = postArgIndex >= 0 ? process.argv[postArgIndex + 1] : "latest";
const outDir = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : "exports";

const post = postArg === "latest" ? await postStore.latestDraft() : await postStore.get(postArg);

if (!post) {
  console.error("No post found. Generate or approve a draft first.");
  process.exit(1);
}

const publishPackage = createXhsPublishPackage(post);
const markdown = renderXhsMarkdownExport(publishPackage);
const safeTitle = publishPackage.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
const filename = `${post.createdAt.slice(0, 10)}-${safeTitle || post.id}.md`;
const outputPath = join(process.cwd(), outDir, filename);

await mkdir(join(process.cwd(), outDir), { recursive: true });
await writeFile(outputPath, markdown, "utf8");

console.log(outputPath);
