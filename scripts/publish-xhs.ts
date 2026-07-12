import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium, type Page } from "playwright";
import { config } from "../server/src/config.js";
import { resolveImageInputs } from "../server/src/publishing/imageInputs.js";
import { finalPublishGuardMessage, shouldAttemptFinalPublish } from "../server/src/publishing/finalPublish.js";
import { normalizePublishedUrl } from "../server/src/publishing/publishedUrl.js";
import { loadXhsSelectorConfig } from "../server/src/publishing/selectorConfig.js";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import { postStore } from "../server/src/storage/postStore.js";
import { runLogStore } from "../server/src/storage/runLogStore.js";
import { readPreflightEvidence } from "./readiness.js";

type PublishMode = "clipboard" | "assist";

interface CliOptions {
  mode: PublishMode;
  post: string;
  markPublished: boolean;
  noPause: boolean;
  dryRun: boolean;
  preflight: boolean;
  waitBeforePreflight: boolean;
  clickPublish: boolean;
  imagePaths: string[];
  imagesDir?: string;
  preflightReport?: string;
  resultReport?: string;
  publishedUrl?: string;
  pageWaitMs: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: "assist",
    post: "latest",
    markPublished: false,
    noPause: false,
    dryRun: false,
    preflight: false,
    waitBeforePreflight: false,
    clickPublish: false,
    imagePaths: [],
    pageWaitMs: 120000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--post") options.post = argv[index + 1] ?? options.post;
    if (arg === "--mode") options.mode = (argv[index + 1] as PublishMode) ?? options.mode;
    if (arg === "--mark-published") options.markPublished = true;
    if (arg === "--no-pause") options.noPause = true;
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--preflight") options.preflight = true;
    if (arg === "--wait-before-preflight") options.waitBeforePreflight = true;
    if (arg === "--click-publish") options.clickPublish = true;
    if (arg === "--image") options.imagePaths.push(argv[index + 1]);
    if (arg === "--images-dir") options.imagesDir = argv[index + 1];
    if (arg === "--preflight-report") options.preflightReport = argv[index + 1];
    if (arg === "--result-report") options.resultReport = argv[index + 1];
    if (arg === "--published-url") options.publishedUrl = argv[index + 1];
    if (arg === "--preflight-wait-ms" || arg === "--page-wait-ms") {
      options.pageWaitMs = Number(argv[index + 1] ?? options.pageWaitMs);
    }
  }

  if (!["clipboard", "assist"].includes(options.mode)) {
    throw new Error("--mode must be clipboard or assist");
  }
  if (!Number.isFinite(options.pageWaitMs) || options.pageWaitMs < 0) {
    throw new Error("--page-wait-ms must be a non-negative number");
  }

  return options;
}

async function waitForEnter(message: string) {
  const reader = createInterface({ input, output });
  try {
    await reader.question(message);
  } finally {
    reader.close();
  }
}

async function waitForBrowserClose(page: Page) {
  if (page.isClosed()) return;
  await page.waitForEvent("close");
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

async function hasAnySelector(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    if ((await page.locator(selector).count().catch(() => 0)) > 0) return true;
  }
  return false;
}

async function waitForUploadPage(page: Page, selectors: Awaited<ReturnType<typeof loadXhsSelectorConfig>>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let lastNavigationAt = 0;

  while (Date.now() < deadline) {
    if (await hasAnySelector(page, selectors.upload)) return true;

    const currentUrl = page.url();
    const shouldRetryUploadUrl =
      currentUrl.includes("creator.xiaohongshu.com") &&
      !currentUrl.includes("/publish/publish") &&
      Date.now() - lastNavigationAt > 5000;

    if (shouldRetryUploadUrl) {
      lastNavigationAt = Date.now();
      await page.goto(config.xhsCreatorUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }

    await page.waitForTimeout(1000);
  }

  return false;
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

async function clickFinalPublish(page: Page, selectors: Awaited<ReturnType<typeof loadXhsSelectorConfig>>) {
  for (const selector of selectors.publishButton) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (count === 0) continue;

    const target = locator.first();
    if (!(await target.isVisible().catch(() => false))) continue;
    if (!(await target.isEnabled().catch(() => false))) continue;

    await target.click({ timeout: 3000 });
    return selector;
  }

  return undefined;
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

async function inspectVisibleButtonCandidates(page: Page) {
  return page
    .locator("button, [role='button']")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
            ariaLabel: element.getAttribute("aria-label") ?? "",
            role: element.getAttribute("role") ?? "",
            className: typeof element.className === "string" ? element.className : "",
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== "hidden" &&
              style.display !== "none"
          };
        })
        .filter((item) => item.visible && (item.text || item.ariaLabel))
        .slice(0, 30)
    )
    .catch(() => []);
}

function hasVisibleSelectorHit(
  report: Awaited<ReturnType<typeof inspectSelectors>>,
  group: "title" | "body" | "upload" | "publishButton"
) {
  if (group === "upload") {
    return Boolean(report.upload?.some((item) => item.count > 0));
  }
  return Boolean(report[group]?.some((item) => item.count > 0 && item.visible));
}

async function writePreflightReport(
  path: string,
  report: {
    postId: string;
    title: string;
    url: string;
    generatedAt: string;
    selectors: Awaited<ReturnType<typeof inspectSelectors>>;
    diagnostics?: {
      visibleButtons: Awaited<ReturnType<typeof inspectVisibleButtonCandidates>>;
    };
  }
) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function writePublishResult(
  path: string | undefined,
  result: {
    status: "queued" | "running" | "clicked" | "failed";
    postId: string;
    detail: string;
    selector?: string;
    url?: string;
  }
) {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ ...result, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

const options = parseArgs(process.argv.slice(2));
const post = options.post === "latest" ? await postStore.latestDraft() : await postStore.get(options.post);

if (!post) {
  console.error("No post found. Generate or approve a draft first.");
  process.exit(1);
}

let publishResultSettled = false;
async function reportFatalPublishError(error: unknown) {
  if (!options.resultReport || publishResultSettled) return;
  publishResultSettled = true;
  const detail = error instanceof Error ? error.message : String(error);
  await writePublishResult(options.resultReport, {
    status: "failed",
    postId: post?.id ?? options.post,
    detail
  }).catch(() => undefined);
}

process.once("uncaughtException", (error) => {
  void reportFatalPublishError(error).finally(() => {
    console.error(error);
    process.exit(1);
  });
});
process.once("unhandledRejection", (error) => {
  void reportFatalPublishError(error).finally(() => {
    console.error(error);
    process.exit(1);
  });
});

if (options.markPublished) {
  const publishedUrl = normalizePublishedUrl(options.publishedUrl);
  if (!publishedUrl) {
    console.error("--mark-published requires a valid http(s) --published-url <url>.");
    process.exit(1);
  }

  await postStore.update(post.id, {
    status: "published",
    publishedUrl
  });
  await runLogStore.append({
    action: "mark-published",
    status: "ok",
    message: `Marked post ${post.id} as published`,
    metadata: {
      postId: post.id,
      hasPublishedUrl: true
    }
  });
  console.log(`Marked post as published: ${post.id}`);
  process.exit(0);
}

const publishPackage = createXhsPublishPackage(post);
const selectorConfig = await loadXhsSelectorConfig();
const preflightEvidence = await readPreflightEvidence();
const imagePaths = await resolveImageInputs({
  imagePaths: [...(post.imageAssets ?? []), ...options.imagePaths].filter(Boolean),
  imagesDir: options.imagesDir
});

await writePublishResult(options.resultReport, {
  status: "running",
  postId: post.id,
  detail: "Browser publish task started."
});

if (options.dryRun) {
  console.log(
    JSON.stringify(
      {
        ...publishPackage,
        imageUploadPaths: imagePaths,
        finalPublishRequested: options.clickPublish,
        finalPublishEnabled: shouldAttemptFinalPublish(options.clickPublish, process.env, preflightEvidence.ok),
        finalPublishPreflightReady: preflightEvidence.ok,
        finalPublishPreflightDetail: preflightEvidence.detail
      },
      null,
      2
    )
  );
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
  if (options.waitBeforePreflight) {
    await waitForEnter(
      "Log in if needed, confirm the Xiaohongshu upload-image page is open, then press Enter here to run selector preflight..."
    );
  }
  console.log(`Waiting for Xiaohongshu upload-image page for up to ${Math.round(options.pageWaitMs / 1000)} seconds...`);
  const uploadPageReady = await waitForUploadPage(page, selectorConfig, options.pageWaitMs);
  console.log(`Upload-image page ready: ${uploadPageReady ? "yes" : "no"}`);
  const uploadSelector = await uploadImages(page, selectorConfig, imagePaths);
  if (imagePaths.length > 0) {
    console.log(`Preflight image upload selector: ${uploadSelector ?? "not found"}`);
    await page.waitForTimeout(5000);
  } else {
    console.log("Preflight running without images. Xiaohongshu may hide title/body fields until an image is uploaded.");
  }
  const fillResult = await assistFill(page, selectorConfig, publishPackage.title, publishPackage.fullText);
  console.log(`Preflight title selector: ${fillResult.titleSelector ?? "not found"}`);
  console.log(`Preflight body selector: ${fillResult.bodySelector ?? "not found"}`);
  await page.waitForTimeout(1500);
  const selectorReport = await inspectSelectors(page, selectorConfig);
  const visibleButtons = await inspectVisibleButtonCandidates(page);
  const requiredGroups = ["title", "body", "upload", "publishButton"] as const;
  const missingGroups = requiredGroups.filter((group) => !hasVisibleSelectorHit(selectorReport, group));
  console.log("Selector preflight:");
  console.log(JSON.stringify(selectorReport, null, 2));
  if (options.preflightReport) {
    await writePreflightReport(options.preflightReport, {
      postId: post.id,
      title: publishPackage.title,
      url: page.url(),
      generatedAt: new Date().toISOString(),
      selectors: selectorReport,
      diagnostics: {
        visibleButtons
      }
    });
    console.log(`Preflight report written: ${options.preflightReport}`);
  }
  await runLogStore.append({
    action: "publish-preflight",
    status: missingGroups.length === 0 ? "ok" : "error",
    message:
      missingGroups.length === 0
        ? `Preflight selectors ready for post ${post.id}`
        : `Preflight missing visible selector hits: ${missingGroups.join(", ")}`,
    metadata: {
      postId: post.id,
      reportPath: options.preflightReport,
      titleVisible: hasVisibleSelectorHit(selectorReport, "title"),
      bodyVisible: hasVisibleSelectorHit(selectorReport, "body"),
      uploadVisible: hasVisibleSelectorHit(selectorReport, "upload"),
      publishButtonVisible: hasVisibleSelectorHit(selectorReport, "publishButton")
    }
  });
  if (!options.noPause) {
    await page.pause();
  }
  await context.close();
  process.exit(0);
}

if (options.mode === "assist") {
  console.log(`Waiting for Xiaohongshu upload-image page for up to ${Math.round(options.pageWaitMs / 1000)} seconds...`);
  const uploadPageReady = await waitForUploadPage(page, selectorConfig, options.pageWaitMs);
  console.log(`Upload-image page ready: ${uploadPageReady ? "yes" : "no"}`);
  const uploadSelector = await uploadImages(page, selectorConfig, imagePaths);
  if (imagePaths.length > 0 && uploadSelector) {
    await page.waitForTimeout(5000);
  }
  const result = await assistFill(page, selectorConfig, publishPackage.title, publishPackage.fullText);
  console.log(`Image upload selector: ${uploadSelector ?? "not used or not found"}`);
  console.log(`Auto-fill title selector: ${result.titleSelector ?? "not found"}`);
  console.log(`Auto-fill body selector: ${result.bodySelector ?? "not found"}`);

  if (shouldAttemptFinalPublish(options.clickPublish, process.env, preflightEvidence.ok)) {
    if (!result.titleSelector || !result.bodySelector) {
      throw new Error("Final publish blocked because title/body auto-fill did not both succeed.");
    }
    const publishSelector = await clickFinalPublish(page, selectorConfig);
    if (!publishSelector) {
      throw new Error("Final publish requested, but no visible enabled publish button was found.");
    }
    console.log(`Final publish clicked with selector: ${publishSelector}`);
    await writePublishResult(options.resultReport, {
      status: "clicked",
      postId: post.id,
      detail: "The Xiaohongshu publish button was clicked. Copy the published note URL back into the dashboard.",
      selector: publishSelector,
      url: page.url()
    });
    publishResultSettled = true;
  } else {
    console.log(finalPublishGuardMessage(options.clickPublish, process.env, preflightEvidence.ok));
    console.log("Review the page before publishing. The script does not click the final publish button by default.");
  }
}

console.log("After manual publish, run:");
console.log(`npm.cmd run publish -- --post ${post.id} --mark-published --published-url <url>`);

if (!options.noPause) {
  console.log("The prepared browser will stay open until you close it. No terminal input is required.");
  await waitForBrowserClose(page);
} else {
await context.close();
}
