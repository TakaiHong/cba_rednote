import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { config } from "../server/src/config.js";
import { resolveImageInputs } from "../server/src/publishing/imageInputs.js";
import { loadXhsSelectorConfig } from "../server/src/publishing/selectorConfig.js";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";

type PublishMode = "clipboard" | "assist";

interface CliOptions {
  mode: PublishMode;
  post: string;
  markPublished: boolean;
  noPause: boolean;
  dryRun: boolean;
  preflight: boolean;
  imagePaths: string[];
  imagesDir?: string;
  publishedUrl?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: "assist",
    post: "latest",
    markPublished: false,
    noPause: false,
    dryRun: false,
    preflight: false,
    imagePaths: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--post") options.post = argv[index + 1] ?? options.post;
    if (arg === "--mode") options.mode = (argv[index + 1] as PublishMode) ?? options.mode;
    if (arg === "--mark-published") options.markPublished = true;
    if (arg === "--no-pause") options.noPause = true;
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--preflight") options.preflight = true;
    if (arg === "--image") options.imagePaths.push(argv[index + 1]);
    if (arg === "--images-dir") options.imagesDir = argv[index + 1];
    if (arg === "--published-url") options.publishedUrl = argv[index + 1];
  }

  if (!["clipboard", "assist"].includes(options.mode)) {
    throw new Error("--mode must be clipboard or assist");
  }

  return options;
}

async function uploadImages(page: Page, selectors: Awaited<ReturnType<typeof loadXhsSelectorConfig>>, imagePaths: string[]) {
  if (imagePaths.length === 0) return undefined;

  for (const selector of selectors.upload) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (count === 0) continue;

    const first = locator.first();
    try {
      await first.setInputFiles(imagePaths, { timeout: 3000 });
      return selector;
    } catch {
      try {
        await first.click({ timeout: 1500 });
        const fileInput = page.locator('input[type="file"]');
        if ((await fileInput.count()) > 0) {
          await fileInput.first().setInputFiles(imagePaths, { timeout: 3000 });
          return 'input[type="file"]';
        }
      } catch {
        continue;
      }
    }
  }

  return undefined;
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

async function assistFill(page: Page, selectors: Awaited<ReturnType<typeof loadXhsSelectorConfig>>, title: string, fullText: string) {
  const titleSelector = await tryFillFirst(page, selectors.title, title);
  const bodySelector = await tryFillFirst(page, selectors.body, fullText);

  return { titleSelector, bodySelector };
}

async function inspectSelectors(page: Page, selectors: Awaited<ReturnType<typeof loadXhsSelectorConfig>>) {
  const groups = Object.entries(selectors);
  const result: Record<string, Array<{ selector: string; count: number; visible: boolean }>> = {};

  for (const [groupName, groupSelectors] of groups) {
    result[groupName] = [];
    for (const selector of groupSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      const visible = count > 0 ? await locator.first().isVisible().catch(() => false) : false;
      result[groupName].push({ selector, count, visible });
    }
  }

  return result;
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
const selectorConfig = await loadXhsSelectorConfig();
const imagePaths = await resolveImageInputs({
  imagePaths: options.imagePaths.filter(Boolean),
  imagesDir: options.imagesDir
});

if (options.dryRun) {
  console.log(JSON.stringify({ ...publishPackage, imageUploadPaths: imagePaths }, null, 2));
  process.exit(0);
}

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
if (imagePaths.length > 0) {
  console.log("Images prepared for upload:");
  console.log(imagePaths.join("\n"));
}
console.log("Visual brief:");
console.log(publishPackage.visualBrief);

if (options.preflight) {
  console.log("Selector preflight:");
  console.log(JSON.stringify(await inspectSelectors(page, selectorConfig), null, 2));
  if (!options.noPause) {
    await page.pause();
  }
  await context.close();
  process.exit(0);
}

if (options.mode === "assist") {
  const uploadSelector = await uploadImages(page, selectorConfig, imagePaths);
  const result = await assistFill(page, selectorConfig, publishPackage.title, publishPackage.fullText);
  console.log(`Image upload selector: ${uploadSelector ?? "not used or not found"}`);
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
