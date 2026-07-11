import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type MarketingPost } from "../types.js";
import { createXhsPublishPackage, renderXhsMarkdownExport } from "./xhsPackage.js";

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
}

export async function exportXhsMarkdownPackage(post: MarketingPost, outDir = "exports") {
  const publishPackage = createXhsPublishPackage(post);
  const markdown = renderXhsMarkdownExport(publishPackage);
  const filename = `${post.createdAt.slice(0, 10)}-${safeFilename(publishPackage.title) || post.id}.md`;
  const absoluteOutDir = join(process.cwd(), outDir);
  const outputPath = join(absoluteOutDir, filename);

  await mkdir(absoluteOutDir, { recursive: true });
  await writeFile(outputPath, markdown, "utf8");

  return {
    postId: post.id,
    outDir: absoluteOutDir,
    filename,
    outputPath
  };
}
