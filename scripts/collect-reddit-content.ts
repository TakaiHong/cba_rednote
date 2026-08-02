import { createReadStream } from "node:fs";
import { appendFile, mkdir, open, readFile, stat, unlink, writeFile, type FileHandle } from "node:fs/promises";
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
const MAX_TRACKED_POSTS = 100_000;
const MAX_FAILED_POSTS = 20_000;
const MAX_TRANSIENT_FAILURES = 3;
const REQUEST_DELAY_MS = 2200;
const POST_NAVIGATION_TIMEOUT_MS = 20_000;
const MAX_COMMENT_SCROLLS = 8;
const MAX_BODY_CHARS = 12_000;
const MAX_COMMENT_CHARS = 4_000;
const MAX_COMMENTS_PER_POST = 100;
const ALLOWED_SUBREDDITS = new Set(["ntu", "sgexams", "asksingapore", "singapore", "sit_singapore"]);
const NTU_RELEVANCE_PATTERN = /\bNTU\b|Nanyang\s+Technological|Nanyang\s+Business\s+School|\bNBS\b/i;

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
  failedPostAttempts: FailedPostAttempt[];
  updatedAt: string;
}

interface FailedPostAttempt {
  postUrl: string;
  attempts: number;
  lastAttemptAt: string;
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
    .replace(/[\r\u2028\u2029]/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/(?:\+?\d[\d()\-\s]{7,}\d)/g, "[phone removed]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
    .replace(/\bu\/[a-z0-9_-]+/gi, "[user removed]")
    .trim();
  return normalized.length > maxChars ? `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...` : normalized;
}

export function isNtuRelatedContent(subreddit: string, title: string, body: string, comments: string[]) {
  if (subreddit.toLowerCase() === "ntu") return true;
  return NTU_RELEVANCE_PATTERN.test([title, body, ...comments].join("\n"));
}

export function orderCollectionCandidates(knownLinks: string[], processed: Set<string>, failedAttempts: Map<string, number>) {
  return [...new Set(knownLinks)]
    .filter((href) => !processed.has(href))
    .filter((href) => (failedAttempts.get(href) ?? 0) < MAX_TRANSIENT_FAILURES)
    .sort((left, right) => (failedAttempts.get(left) ?? 0) - (failedAttempts.get(right) ?? 0));
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
      failedPostAttempts: Array.isArray(parsed.failedPostAttempts)
        ? parsed.failedPostAttempts.flatMap((value) => {
            if (!value || typeof value !== "object") return [];
            const candidate = value as Partial<FailedPostAttempt>;
            const postUrl = typeof candidate.postUrl === "string" ? canonicalRedditPostUrl(candidate.postUrl) : undefined;
            const attempts = typeof candidate.attempts === "number" && Number.isFinite(candidate.attempts) ? Math.max(1, Math.floor(candidate.attempts)) : 1;
            return postUrl ? [{ postUrl, attempts, lastAttemptAt: typeof candidate.lastAttemptAt === "string" ? candidate.lastAttemptAt : "" }] : [];
          })
        : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
    };
  } catch {
    return { processedPostUrls: [], failedPostAttempts: [], updatedAt: "" };
  }
}

async function readStoredPostUrls(outputPath: string) {
  const urls = new Set<string>();
  try {
    for await (const line of streamFileLines(outputPath)) {
      try {
        const record = JSON.parse(line) as { postUrl?: unknown };
        if (typeof record.postUrl !== "string") continue;
        const canonical = canonicalRedditPostUrl(record.postUrl);
        if (canonical) urls.add(canonical);
      } catch {
        // Ignore a partially written final line after an unexpected process interruption.
      }
    }
  } catch {
    // No corpus exists yet.
  }
  return urls;
}

async function* streamFileLines(filePath: string) {
  let remainder = "";
  for await (const chunk of createReadStream(filePath, { encoding: "utf8" })) {
    remainder += chunk;
    let newlineIndex = remainder.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = remainder.slice(0, newlineIndex);
      yield line.endsWith("\r") ? line.slice(0, -1) : line;
      remainder = remainder.slice(newlineIndex + 1);
      newlineIndex = remainder.indexOf("\n");
    }
  }
  if (remainder) yield remainder.endsWith("\r") ? remainder.slice(0, -1) : remainder;
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
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: POST_NAVIGATION_TIMEOUT_MS });
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

function stateSnapshot(processed: Set<string>, failedAttempts: Map<string, FailedPostAttempt>): CollectorState {
  return {
    processedPostUrls: [...processed].slice(-MAX_TRACKED_POSTS),
    failedPostAttempts: [...failedAttempts.values()]
      .filter((entry) => entry.attempts < MAX_TRANSIENT_FAILURES)
      .slice(-MAX_FAILED_POSTS),
    updatedAt: new Date().toISOString()
  };
}

interface CollectorLock {
  path: string;
  handle: FileHandle;
}

async function acquireCollectorLock(outputPath: string): Promise<CollectorLock> {
  const lockPath = `${outputPath}.lock`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n`, "utf8");
      return { path: lockPath, handle };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      const ownerPid = Number.parseInt((await readFile(lockPath, "utf8").catch(() => "")).trim(), 10);
      let ownerIsRunning = Number.isInteger(ownerPid) && ownerPid > 0;
      if (ownerIsRunning) {
        try {
          process.kill(ownerPid, 0);
        } catch {
          ownerIsRunning = false;
        }
      }
      if (ownerIsRunning || attempt === 1) {
        throw new Error("Another Reddit content collection is already running. Wait for it to finish before starting a new batch.");
      }
      await unlink(lockPath).catch(() => undefined);
    }
  }
  throw new Error("Unable to acquire the Reddit content collection lock.");
}

async function releaseCollectorLock(lock: CollectorLock) {
  await lock.handle.close();
  await unlink(lock.path).catch(() => undefined);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await Promise.all([options.output, options.state].map((filePath) => mkdir(path.dirname(filePath), { recursive: true })));
  const state = await readState(options.state);
  const storedUrls = await readStoredPostUrls(options.output);
  const processed = new Set([
    ...state.processedPostUrls.map(canonicalRedditPostUrl).filter((href): href is string => Boolean(href)),
    ...storedUrls
  ]);
  const failedAttempts = new Map(
    state.failedPostAttempts
      .filter((entry) => !processed.has(entry.postUrl))
      .map((entry) => [entry.postUrl, entry] as const)
  );
  const knownLinks = (await readTextLines(options.links))
    .map(canonicalRedditPostUrl)
    .filter((href): href is string => Boolean(href))
    .filter((href) => {
      const subreddit = redditSubreddit(href);
      return subreddit ? ALLOWED_SUBREDDITS.has(subreddit) : false;
    });
  const candidates = orderCollectionCandidates(
    knownLinks,
    processed,
    new Map([...failedAttempts].map(([postUrl, entry]) => [postUrl, entry.attempts]))
  );
  let currentSize = await fileSize(options.output);
  let storedCount = storedUrls.size;
  if (storedCount >= options.targetPosts || currentSize >= options.maxBytes || candidates.length === 0) {
    await writeState(options.state, stateSnapshot(processed, failedAttempts));
    console.log(`No collection run needed. Stored posts: ${storedCount}/${options.targetPosts}. Corpus bytes: ${currentSize}/${options.maxBytes}. Eligible unprocessed links: ${candidates.length}.`);
    return;
  }

  const lock = await acquireCollectorLock(options.output);
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  let stoppedForCaptcha = false;
  let collected = 0;
  let skipped = 0;
  try {
    context = await chromium.launchPersistentContext(options.profile, {
      channel: "chrome",
      headless: false,
      viewport: { width: 1440, height: 960 }
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto("https://www.reddit.com/search/?q=NTU&sort=new", { waitUntil: "domcontentloaded" });
    await Promise.all(context.pages().filter((candidate) => candidate !== page && candidate.url() === "about:blank").map((candidate) => candidate.close()));
    console.log(`Chrome is open on a Reddit post. Complete any normal login or CAPTCHA in the next ${Math.round(options.waitMs / 1000)} seconds. Do not close the window; collection starts automatically.`);
    await page.waitForTimeout(options.waitMs);
    if (page.isClosed()) throw new Error("The Chrome Reddit page was closed before collection started. Keep the Reddit tab open and rerun the command.");
    if (await isCaptchaPage(page)) {
      stoppedForCaptcha = true;
    } else {
      const maxThisRun = Math.min(options.batchLimit, options.targetPosts - storedCount);
      for (const postUrl of candidates.slice(0, maxThisRun)) {
        if (currentSize >= options.maxBytes) break;
        let record: RedditContentRecord | undefined;
        try {
          record = await collectPostRecord(page, postUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const previous = failedAttempts.get(postUrl);
          const attempts = (previous?.attempts ?? 0) + 1;
          failedAttempts.set(postUrl, { postUrl, attempts, lastAttemptAt: new Date().toISOString() });
          await writeState(options.state, stateSnapshot(processed, failedAttempts));
          const disposition = attempts >= MAX_TRANSIENT_FAILURES
            ? "Deferred after three navigation failures; retained locally for later manual review."
            : `Will retry after unprocessed links are exhausted (${attempts}/${MAX_TRANSIENT_FAILURES}).`;
          console.warn(`Transient page failure for ${postUrl}: ${message}\n${disposition}`);
          skipped += 1;
          continue;
        }
        if (!record) {
          if (await isCaptchaPage(page)) {
            stoppedForCaptcha = true;
            break;
          }
          processed.add(postUrl);
          failedAttempts.delete(postUrl);
          await writeState(options.state, stateSnapshot(processed, failedAttempts));
          skipped += 1;
          continue;
        }
        if (!isNtuRelatedContent(record.subreddit, record.title, record.body, record.comments)) {
          processed.add(record.postUrl);
          failedAttempts.delete(record.postUrl);
          await writeState(options.state, stateSnapshot(processed, failedAttempts));
          skipped += 1;
          continue;
        }
        const line = `${JSON.stringify(record)}\n`;
        const lineSize = Buffer.byteLength(line, "utf8");
        if (currentSize + lineSize > options.maxBytes) break;
        await appendFile(options.output, line, "utf8");
        currentSize += lineSize;
        processed.add(record.postUrl);
        failedAttempts.delete(record.postUrl);
        storedCount += 1;
        await writeState(options.state, stateSnapshot(processed, failedAttempts));
        collected += 1;
        await page.waitForTimeout(REQUEST_DELAY_MS);
      }
    }
  } finally {
    await writeState(options.state, stateSnapshot(processed, failedAttempts));
    await context?.close();
    await releaseCollectorLock(lock);
  }
  console.log(`Collected ${collected} post-content records. Skipped ${skipped} unavailable or irrelevant records. Stored posts: ${storedCount}/${options.targetPosts}. Corpus bytes: ${currentSize}/${options.maxBytes}.`);
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
