import { exportXhsMarkdownPackage } from "../server/src/publishing/exportPackage.js";
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

const result = await exportXhsMarkdownPackage(post, outDir);

console.log(result.outputPath);
