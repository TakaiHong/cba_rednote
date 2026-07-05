import { chromium } from "playwright";
import { config } from "../server/src/config.js";
import { postStore } from "../server/src/storage/postStore.js";

const postArgIndex = process.argv.findIndex((arg) => arg === "--post");
const postArg = postArgIndex >= 0 ? process.argv[postArgIndex + 1] : "latest";

const post = postArg === "latest" ? await postStore.latestDraft() : await postStore.get(postArg);

if (!post) {
  console.error("No post found. Generate or approve a draft first.");
  process.exit(1);
}

const textForClipboard = [
  post.title,
  "",
  post.body,
  "",
  post.callToAction,
  "",
  post.tags.map((tag) => `#${tag}`).join(" ")
].join("\n");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(config.xhsCreatorUrl, { waitUntil: "domcontentloaded" });
await page.evaluate(async (text) => {
  await navigator.clipboard.writeText(text);
}, textForClipboard);

console.log("Opened Xiaohongshu creator center.");
console.log("Draft copied to clipboard. Paste it into the editor, review, then publish manually.");
console.log(`Post id: ${post.id}`);
console.log(`Title: ${post.title}`);

await page.pause();
