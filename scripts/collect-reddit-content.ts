import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { canonicalRedditPostUrl, redditSubreddit } from "./collect-reddit-links.js";

const DEFAULT_PROFILE = path.resolve(".tmp", "reddit-link-collector-profile");
const DEFAULT_LINKS = path.resolve(".tmp", "reddit-ntu-corpus-links.txt");
const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-content-corpus.jsonl");
const DEFAULT_STATE = path.resolve(".tmp", "reddit-ntu-content-state.json");
const DEFAULT_WAIT_SECONDS = 30;
const DEFAULT_BATCH_LIMIT = 20;
const MAX_BATCH_LIMIT = 100;
const DEFAULT_TARGET_POSTS = 10_000;
const MAX_TARGET_POSTS = 10_000;
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024;
const REQUEST_DELAY_MS = 2200;
const MAX_COMMENT_SCROLLS = 8;
const MAX_BODY_CHARS = 12_000;
const MAX_COMMENT_CHARS = 4_000;
const MAX_COMMENTS_PER_POST = 100;
const ALLOWED_SUBREDDITS = new Set(["ntu", "sgexams", "asksingapore", "singapore", "sit_singapore"]);

interface Options {
  profile: string;
  links: string;
  output: string;
  state: string;
  waitMs: number;
  batchLimit: number;
  targetPosts: number;
  maxBytes: number;
}

interface CollectorState {
  processedPostUrls: string[];
  updatedAt: string;
}

interface RedditContentRecord {
  schemaVersion: 1;
  collectedAt: string;
  postUrl: string;
  subreddit: string;
  title: string;
  body: string;
  comments: string[];
  collectionNotice: string;
}

export function parseByteLimit(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_BYTES;
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return DEFAULT_MAX_BYTES;
  const amount = Number(match[1]);
  const unit = match[2] ?? "b";
  const multiplier = unit === "gb" ? 1024 ** 3 : unit === "mb" ? 1024 ** 2 : unit === "kb" ? 1024 : 1;
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount * multiplier) : DEFAULT_MAX_BYTES;
}

export function redactPublicText(value: string, maxChars: number): string {
  const normalized = value
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/(?:\+?\d[\d()\-\s]{7,}\d)/g, "[phone removed]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
    .replace(/\bu\/[a-z0-9_-]+/gi, "[user removed]")
    .trim();
  return normalized.length > maxChars ? `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…` : normalized;
}

export function parseOptions(args: string[]): Options {
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    const value = index >= 0 ? args[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : undefined;
  };
  const numberValue = (flag: string, fallback: number, max: number) => {
    const value = Number(valueFor(flag) ?? fallback);
    return Number.isFinite(value) ? Math.max(1, Math.min(max, Math.floor(value))) : fallback;
  };
  const waitSeconds = Number(valueFor("--wait-seconds") ?? DEFAULT_WAIT_SECONDS);
  return {
    profile: path.resolve(valueFor("--profile") || DEFAULT_PROFILE),
    links: path.resolve(valueFor("--links") || DEFAULT_LINKS),
    output: path.resolve(valueFor("--out") || DEFAULT_OUTPUT),
    state: path.resolve(valueFor("--state") || DEFAULT_STATE),
    waitMs: Number.isFinite(waitSeconds) ? Math.max(0, Math.min(300, waitSeconds)) * 1000 : DEFAULT_WAIT_SECONDS * 1000,
    batchLimit: numberValue("--limit", DEFAULT_BATCH_LIMIT, MAX_BATCH_LIMIT),
    targetPosts: numberValue("--target-posts", DEFAULT_TARGET_POSTS, MAX_TARGET_POSTS),
    maxBytes: parseByteLimit(valueFor("--max-bytes"))
  };
}

async function readTextLines(filePath: string) {
  try {
    const contents = await readFile(filePath, "utf8");
    return contents.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function readState(statePath: string): Promise<CollectorState> {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as Partial<CollectorState>;
    return {
      processedPostUrls: Array.isArray(parsed.processedPostUrls) ? parsed.processedPostUrls.filter((value): value is string => typeof value === "string") : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
    };
  } catch {
    return { processedPostUrls: [], updatedAt: "" };
  }
}

async function fileSize(filePath: string) {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function isCaptchaPage(page: Page) {
  const url = page.url().toLowerCase();
  const text = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return url.includes("captcha") || text.includes("captcha") || text.includes("unusual traffic");
}

function contentFromPage(page: Page) {
  return page.evaluate(`
    (() => {
      const readText = (element) => (element && element.textContent ? element.textContent : "").trim();
      const firstText = (selectors) => {
        for (const selector of selectors) {
          const value = readText(document.querySelector(selector));
          if (value) return value;
        }
        return "";
      };
      const title = firstText(["h1", "[data-testid='post-title']"]);
      const body = firstText([
        "shreddit-post [slot='text-body']",
        "shreddit-post [data-testid='post-content']",
        "[data-testid='post-container'] [data-testid='post-content']",
        "[data-click-id='text']"
      ]);
      const comments = Array.from(document.querySelectorAll("shreddit-comment, [data-testid='comment']"))
        .map((comment) => readText(comment.querySelector("[slot='comment'], [data-testid='comment-content']") || comment))
        .filter(Boolean);
      return { title, body, comments };
    })()
  `) as Promise<{ title: string; body: string; comments: string[] }>;
}

async function collectPostRecord(page: Page, postUrl: string): Promise<RedditContentRecord | undefined> {
  await page.goto(postUrl, { waitUntil: "domcontentloaded" });
  if (await isCaptchaPage(page)) return undefined;
  await page.waitForTimeout(900);
  for (let scroll = 0; scroll < MAX_COMMENT_SCROLLS; scroll += 1) {
    await page.mouse.wheel(0, 1100);
    await page.waitForTimeout(700);
    if (await isCaptchaPage(page)) return undefined;
  }
  const raw = await contentFromPage(page);
  const canonical = canonicalRedditPostUrl(postUrl);
  const subreddit = canonical ? redditSubreddit(canonical) : undefined;
  if (!canonical || !subreddit || !ALLOWED_SUBREDDITS.has(subreddit)) return undefined;
  const comments = [...new Set(raw.comments.map((comment) => redactPublicText(comment, MAX_COMMENT_CHARS)).filter(Boolean))]
    .slice(0, MAX_COMMENTS_PER_POST);
  const title = redactPublicText(raw.title, 500);
  const body = redactPublicText(raw.body, MAX_BODY_CHARS);
  if (!title && !body && comments.length === 0) return undefined;
  return {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    postUrl: canonical,
    subreddit,
    title,
    body,
    comments,
    collectionNotice: "Public Reddit discussion signal. Usernames, profile data, links, emails, and phone numbers are not retained. Do not treat community discussion as official NTU fact."
  };
}

async function writeState(statePath: string, state: CollectorState) {
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await Promise.all([options.output, options.state].map((filePath) => mkdir(path.dirname(filePath), { recursive: true })));
  const state = await readState(options.state);
  const processed = new Set(state.processedPostUrls.map(canonicalRedditPostUrl).filter((href): href is string => Boolean(href)));
  const knownLinks = (await readTextLines(options.links))
    .map(canonicalRedditPostUrl)
    .filter((href): href is string => Boolean(href))
    .filter((href) => {
      const subreddit = redditSubreddit(href);
      return subreddit ? ALLOWED_SUBREDDITS.has(subreddit) : false;
    });
  const candidates = [...new Set(knownLinks)].filter((href) => !processed.has(href));
  let currentSize = await fileSize(options.output);
  if (processed.size >= options.targetPosts || currentSize >= options.maxBytes || candidates.length === 0) {
    console.log(`No collection run needed. Processed posts: ${processed.size}/${options.targetPosts}. Corpus bytes: ${currentSize}/${options.maxBytes}. Eligible unprocessed links: ${candidates.length}.`);
    return;
  }

  const context = await chromium.launchPersistentContext(options.profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });
  let stoppedForCaptcha = false;
  let collected = 0;
  let skipped = 0;
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(candidates[0], { waitUntil: "domcontentloaded" });
    await Promise.all(context.pages().filter((candidate) => candidate !== page && candidate.url() === "about:blank").map((candidate) => candidate.close()));
    console.log(`Chrome is open on a Reddit post. Complete any normal login or CAPTCHA in the next ${Math.round(options.waitMs / 1000)} seconds. Do not close the window; collection starts automatically.`);
    await page.waitForTimeout(options.waitMs);
    if (page.isClosed()) throw new Error("The Chrome Reddit page was closed before collection started. Keep the Reddit tab open and rerun the command.");
    if (await isCaptchaPage(page)) {
      stoppedForCaptcha = true;
    } else {
      const maxThisRun = Math.min(options.batchLimit, options.targetPosts - processed.size);
      for (const postUrl of candidates.slice(0, maxThisRun)) {
        if (currentSize >= options.maxBytes) break;
        const record = await collectPostRecord(page, postUrl);
        if (!record) {
          if (await isCaptchaPage(page)) {
            stoppedForCaptcha = true;
            break;
          }
          processed.add(postUrl);
          skipped += 1;
          continue;
        }
        const line = `${JSON.stringify(record)}\n`;
        const lineSize = Buffer.byteLength(line, "utf8");
        if (currentSize + lineSize > options.maxBytes) break;
        await appendFile(options.output, line, "utf8");
        currentSize += lineSize;
        processed.add(record.postUrl);
        collected += 1;
        await page.waitForTimeout(REQUEST_DELAY_MS);
      }
    }
  } finally {
    await writeState(options.state, { processedPostUrls: [...processed].slice(-MAX_TARGET_POSTS), updatedAt: new Date().toISOString() });
    await context.close();
  }
  console.log(`Collected ${collected} post-content records. Skipped ${skipped} unavailable records. Processed posts: ${processed.size}/${options.targetPosts}. Corpus bytes: ${currentSize}/${options.maxBytes}.`);
  if (stoppedForCaptcha) {
    console.error("Reddit presented a CAPTCHA or traffic check. Collection stopped after saving any completed records. Complete it normally, then rerun the command.");
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
