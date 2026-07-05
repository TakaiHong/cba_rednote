import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { config } from "../server/src/config.js";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";

type PublishMode = "clipboard" | "assist";

interface CliOptions {
  mode: PublishMode;
  post: string;
  markPublished: boolean;
  noPause: boolean;
  publishedUrl?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: "assist",
    post: "latest",
    markPublished: false,
    noPause: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--post") options.post = argv[index + 1] ?? options.post;
    if (arg === "--mode") options.mode = (argv[index + 1] as PublishMode) ?? options.mode;
    if (arg === "--mark-published") options.markPublished = true;
    if (arg === "--no-pause") options.noPause = true;
    if (arg === "--published-url") options.publishedUrl = argv[index + 1];
  }

  if (!["clipboard", "assist"].includes(options.mode)) {
    throw new Error("--mode must be clipboard or assist");
  }

  return options;
}

async function writeClipboard(page: Page, text: string) {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, text);
}

async function tryFillFirst(page: Page, selectors: string[], value: string) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) continue;

    const target = locator.first();
    if (!(await target.isVisible().catch(() => false))) continue;

    try {
      await target.fill(value, { timeout: 1500 });
      return selector;
    } catch {
      try {
        await target.click({ timeout: 1500 });
        await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
        await page.keyboard.type(value);
        return selector;
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

async function assistFill(page: Page, title: string, fullText: string) {
  const titleSelector = await tryFillFirst(
    page,
    [
      'input[placeholder*="标题"]',
      'textarea[placeholder*="标题"]',
      'input[maxlength="20"]',
      'input[type="text"]'
    ],
    title
  );

  const bodySelector = await tryFillFirst(
    page,
    [
      'textarea[placeholder*="正文"]',
      'textarea[placeholder*="描述"]',
      '[contenteditable="true"]',
      "textarea"
    ],
    fullText
  );

  return { titleSelector, bodySelector };
}

const options = parseArgs(process.argv.slice(2));
const post = options.post === "latest" ? await postStore.latestDraft() : await postStore.get(options.post);

if (!post) {
  console.error("No post found. Generate or approve a draft first.");
  process.exit(1);
}

if (options.markPublished) {
  await postStore.update(post.id, {
    status: "published",
    publishedUrl: options.publishedUrl
  });
  console.log(`Marked post as published: ${post.id}`);
  process.exit(0);
}

const publishPackage = createXhsPublishPackage(post);
const profileDir = join(process.cwd(), "playwright/.auth/xhs-profile");
await mkdir(profileDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1360, height: 900 }
});
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(config.xhsCreatorUrl, { waitUntil: "domcontentloaded" });
await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: new URL(config.xhsCreatorUrl).origin
});
await writeClipboard(page, [publishPackage.title, "", publishPackage.fullText].join("\n"));

console.log("Opened Xiaohongshu creator center with persistent login profile.");
console.log(`Post id: ${publishPackage.postId}`);
console.log(`Title: ${publishPackage.title}`);
console.log("Draft content is copied to the browser clipboard.");

if (options.mode === "assist") {
  const result = await assistFill(page, publishPackage.title, publishPackage.fullText);
  console.log(`Auto-fill title selector: ${result.titleSelector ?? "not found"}`);
  console.log(`Auto-fill body selector: ${result.bodySelector ?? "not found"}`);
  console.log("Review the page before publishing. The script does not click the final publish button.");
}

console.log("After manual publish, run:");
console.log(`npm.cmd run publish -- --post ${post.id} --mark-published --published-url <url>`);

if (!options.noPause) {
  await page.pause();
}

await context.close();
