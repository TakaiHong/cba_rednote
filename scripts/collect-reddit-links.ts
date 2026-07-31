import { chromium, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_QUERY = "NTU";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_PROFILE = path.resolve(".tmp", "reddit-link-collector-profile");
const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-links.txt");
const DEFAULT_HISTORY = path.resolve(".tmp", "reddit-ntu-link-history.txt");
const DEFAULT_WAIT_SECONDS = 45;
const MAX_SCROLLS = 30;
const MAX_HISTORY_LINKS = 5_000;

interface Options {
  query: string;
  limit: number;
  profile: string;
  output: string;
  history: string;
  waitMs: number;
}

function parseOptions(args: string[]): Options {
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const limit = Number(valueFor("--limit") ?? DEFAULT_LIMIT);
  const waitSeconds = Number(valueFor("--wait-seconds") ?? DEFAULT_WAIT_SECONDS);
  return {
    query: valueFor("--query")?.trim() || DEFAULT_QUERY,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit))) : DEFAULT_LIMIT,
    profile: path.resolve(valueFor("--profile") || DEFAULT_PROFILE),
    output: path.resolve(valueFor("--out") || DEFAULT_OUTPUT),
    history: path.resolve(valueFor("--history") || DEFAULT_HISTORY),
    waitMs: Number.isFinite(waitSeconds) ? Math.max(0, Math.min(300, waitSeconds)) * 1000 : DEFAULT_WAIT_SECONDS * 1000
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

async function collectVisiblePostLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href*="/comments/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map(canonicalRedditPostUrl).filter((href): href is string => Boolean(href)))];
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(path.dirname(options.profile), { recursive: true });
  await mkdir(path.dirname(options.output), { recursive: true });
  await mkdir(path.dirname(options.history), { recursive: true });
  const history = await readLinkHistory(options.history);

  const context = await chromium.launchPersistentContext(options.profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(options.query)}&sort=new`, { waitUntil: "domcontentloaded" });
    await Promise.all(
      context.pages()
        .filter((candidate) => candidate !== page && candidate.url() === "about:blank")
        .map((candidate) => candidate.close())
    );
    console.log(`Chrome is open on the Reddit search page. Complete any normal login or CAPTCHA in the next ${Math.round(options.waitMs / 1000)} seconds. Do not close the window; collection starts automatically.`);
    await page.waitForTimeout(options.waitMs);
    if (page.isClosed()) throw new Error("The Chrome search page was closed before collection started. Keep the Reddit tab open and rerun the command.");
    if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. Complete it manually, then rerun the command.");

    const links = new Set<string>();
    for (let scroll = 0; scroll < MAX_SCROLLS && links.size < options.limit; scroll += 1) {
      if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. The collector stopped without saving additional links.");
      for (const href of onlyNewLinks(await collectVisiblePostLinks(page), history, options.limit)) {
        links.add(href);
        if (links.size >= options.limit) break;
      }
      if (links.size >= options.limit) break;
      await page.mouse.wheel(0, 1100);
      await page.waitForTimeout(2200);
    }

    const result = [...links].slice(0, options.limit);
    await writeFile(options.output, `${result.join("\n")}${result.length ? "\n" : ""}`, "utf8");
    await writeFile(options.history, `${[...history, ...result].slice(-MAX_HISTORY_LINKS).join("\n")}\n`, "utf8");
    console.log(`Saved ${result.length} new Reddit post links to ${options.output}. History now contains ${Math.min(MAX_HISTORY_LINKS, history.size + result.length)} links.`);
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
