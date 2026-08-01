import { chromium, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_QUERY = "NTU";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 300;
const DEFAULT_PROFILE = path.resolve(".tmp", "reddit-link-collector-profile");
const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-links.txt");
const DEFAULT_HISTORY = path.resolve(".tmp", "reddit-ntu-link-history.txt");
const DEFAULT_CORPUS = path.resolve(".tmp", "reddit-ntu-corpus-links.txt");
const DEFAULT_WAIT_SECONDS = 45;
const MAX_SCROLLS_PER_SOURCE = 50;
const MAX_IDLE_SCROLLS = 6;
const NAVIGATION_RETRY_DELAY_MS = 5000;
const MAX_HISTORY_LINKS = 100_000;
const MAX_CORPUS_LINKS = 100_000;
const DEFAULT_SUBREDDITS = ["ntu", "sgexams", "asksingapore", "singapore", "sit_singapore"];
// Search newest-first for items that can become stale quickly. Broader student
// life queries remain useful, but these operational topics get collected first.
const DEFAULT_TOPICS = [
  "course registration",
  "add drop",
  "timetable",
  "hall",
  "accommodation",
  "orientation",
  "matriculation",
  "exchange",
  "internship",
  "student pass",
  "visa",
  "convocation",
  "help",
  "housing"
];

interface Options {
  query: string;
  limit: number;
  profile: string;
  output: string;
  history: string;
  corpus: string;
  waitMs: number;
  allowedSubreddits: Set<string>;
  topics: string[];
}

export function parseOptions(args: string[]): Options {
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    const value = index >= 0 ? args[index + 1] : undefined;
    return value && !value.startsWith("--") ? value : undefined;
  };
  const limit = Number(valueFor("--limit") ?? DEFAULT_LIMIT);
  const waitSeconds = Number(valueFor("--wait-seconds") ?? DEFAULT_WAIT_SECONDS);
  const subredditInput = valueFor("--subreddits") ?? DEFAULT_SUBREDDITS.join(",");
  const allowedSubreddits = new Set(subredditInput.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  const topicsWereExplicitlyBlank = args.includes("--no-topics") || (args.includes("--topics") && !valueFor("--topics"));
  const topicInput = topicsWereExplicitlyBlank ? "" : (valueFor("--topics") ?? DEFAULT_TOPICS.join(","));
  const topics = [...new Set(topicInput.split(",").map((value) => value.trim()).filter(Boolean))];
  return {
    query: valueFor("--query")?.trim() || DEFAULT_QUERY,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit))) : DEFAULT_LIMIT,
    profile: path.resolve(valueFor("--profile") || DEFAULT_PROFILE),
    output: path.resolve(valueFor("--out") || DEFAULT_OUTPUT),
    history: path.resolve(valueFor("--history") || DEFAULT_HISTORY),
    corpus: path.resolve(valueFor("--corpus") || DEFAULT_CORPUS),
    waitMs: Number.isFinite(waitSeconds) ? Math.max(0, Math.min(300, waitSeconds)) * 1000 : DEFAULT_WAIT_SECONDS * 1000,
    allowedSubreddits,
    topics
  };
}

export function canonicalRedditPostUrl(href: string): string | undefined {
  try {
    const url = new URL(href, "https://www.reddit.com");
    if (!/(^|\.)reddit\.com$/i.test(url.hostname)) return undefined;
    const match = url.pathname.match(/^\/r\/[^/]+\/comments\/[^/]+/i);
    return match ? `https://www.reddit.com${match[0]}` : undefined;
  } catch {
    return undefined;
  }
}

export function redditSubreddit(href: string): string | undefined {
  const canonical = canonicalRedditPostUrl(href);
  const match = canonical?.match(/^https:\/\/www\.reddit\.com\/r\/([^/]+)\/comments\//i);
  return match?.[1].toLowerCase();
}

export function filterAllowedSubredditLinks(candidates: string[], allowedSubreddits: Set<string>) {
  return candidates.filter((href) => {
    const subreddit = redditSubreddit(href);
    return subreddit ? allowedSubreddits.has(subreddit) : false;
  });
}

export function redditCollectionUrl(query: string, subreddit: string): string {
  if (subreddit === "ntu" && query.trim().toLowerCase() === "ntu") {
    return "https://www.reddit.com/r/NTU/new/?sort=new";
  }
  const params = new URLSearchParams({ q: query, restrict_sr: "1", sort: "new" });
  return `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search/?${params.toString()}`;
}

export function redditCollectionPlan(query: string, allowedSubreddits: Set<string>, topics: string[]) {
  const subreddits = [...allowedSubreddits];
  const plan = subreddits.includes("ntu") && query.trim().toLowerCase() === "ntu"
    ? [{ subreddit: "ntu", query }]
    : [];
  const topicQueries = [query, ...topics.map((topic) => `${query} ${topic}`)];
  for (const subreddit of subreddits) {
    if (subreddit === "ntu" && query.trim().toLowerCase() === "ntu") continue;
    for (const topicQuery of topicQueries) plan.push({ subreddit, query: topicQuery });
  }
  return plan;
}

export function onlyNewLinks(candidates: string[], history: Set<string>, limit: number) {
  return [...new Set(candidates)].filter((href) => !history.has(href)).slice(0, limit);
}

async function readLinkHistory(historyPath: string) {
  try {
    const contents = await readFile(historyPath, "utf8");
    return new Set(contents.split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function isCaptchaPage(page: Page) {
  const url = page.url().toLowerCase();
  const text = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return url.includes("captcha") || text.includes("captcha") || text.includes("unusual traffic");
}

async function collectVisiblePostLinks(page: Page, allowedSubreddits: Set<string>): Promise<string[]> {
  const hrefs = await page.locator('a[href*="/comments/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const canonical = hrefs.map(canonicalRedditPostUrl).filter((href): href is string => Boolean(href));
  return [...new Set(filterAllowedSubredditLinks(canonical, allowedSubreddits))];
}

async function navigateWithSingleRetry(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  } catch (firstError) {
    console.warn(`Temporary Reddit navigation failure. Retrying once after ${NAVIGATION_RETRY_DELAY_MS / 1000} seconds.`);
    await page.waitForTimeout(NAVIGATION_RETRY_DELAY_MS);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch {
      throw firstError;
    }
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(path.dirname(options.profile), { recursive: true });
  await mkdir(path.dirname(options.output), { recursive: true });
  await mkdir(path.dirname(options.history), { recursive: true });
  await mkdir(path.dirname(options.corpus), { recursive: true });
  const history = await readLinkHistory(options.history);
  const corpus = await readLinkHistory(options.corpus);

  const context = await chromium.launchPersistentContext(options.profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await navigateWithSingleRetry(page, `https://www.reddit.com/search/?q=${encodeURIComponent(options.query)}&sort=new`);
    await Promise.all(
      context.pages()
        .filter((candidate) => candidate !== page && candidate.url() === "about:blank")
        .map((candidate) => candidate.close())
    );
    console.log(`Chrome is open on the Reddit search page. Complete any normal login or CAPTCHA in the next ${Math.round(options.waitMs / 1000)} seconds. Do not close the window; collection starts automatically.`);
    console.log(`Allowed communities: ${[...options.allowedSubreddits].join(", ")}.`);
    console.log(`Topic searches: ${options.topics.join(", ")}.`);
    await page.waitForTimeout(options.waitMs);
    if (page.isClosed()) throw new Error("The Chrome search page was closed before collection started. Keep the Reddit tab open and rerun the command.");
    if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. Complete it manually, then rerun the command.");

    const links = new Set<string>();
    for (const source of redditCollectionPlan(options.query, options.allowedSubreddits, options.topics)) {
      if (links.size >= options.limit) break;
      await navigateWithSingleRetry(page, redditCollectionUrl(source.query, source.subreddit));
      if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. The collector stopped without saving additional links.");

      let idleScrolls = 0;
      for (let scroll = 0; scroll < MAX_SCROLLS_PER_SOURCE && links.size < options.limit && idleScrolls < MAX_IDLE_SCROLLS; scroll += 1) {
        if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. The collector stopped without saving additional links.");
        const visibleLinks = await collectVisiblePostLinks(page, new Set([source.subreddit]));
        const candidates = onlyNewLinks(visibleLinks, history, options.limit);
        const before = links.size;
        for (const href of candidates) {
          links.add(href);
          if (links.size >= options.limit) break;
        }
        // Known links still mean this source has more scrollable results; continue past them to reach older unseen posts.
        idleScrolls = visibleLinks.length === 0 ? idleScrolls + 1 : 0;
        if (links.size >= options.limit || idleScrolls >= MAX_IDLE_SCROLLS) break;
        await page.mouse.wheel(0, 1100);
        await page.waitForTimeout(2200);
      }
    }

    const result = [...links].slice(0, options.limit);
    await writeFile(options.output, `${result.join("\n")}${result.length ? "\n" : ""}`, "utf8");
    await writeFile(options.history, `${[...history, ...result].slice(-MAX_HISTORY_LINKS).join("\n")}\n`, "utf8");
    const nextCorpus = [...corpus, ...result].slice(-MAX_CORPUS_LINKS);
    await writeFile(options.corpus, `${nextCorpus.join("\n")}${nextCorpus.length ? "\n" : ""}`, "utf8");
    console.log(`Saved ${result.length} new Reddit post links to ${options.output}. History now contains ${Math.min(MAX_HISTORY_LINKS, history.size + result.length)} links. Corpus now contains ${nextCorpus.length} allowed-source links at ${options.corpus}.`);
  } finally {
    await context.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
