import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_QUERY = "NTU";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_PROFILE = path.resolve(".tmp", "reddit-link-collector-profile");
const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-links.txt");

interface Options {
  query: string;
  limit: number;
  profile: string;
  output: string;
}

function parseOptions(args: string[]): Options {
  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const limit = Number(valueFor("--limit") ?? DEFAULT_LIMIT);
  return {
    query: valueFor("--query")?.trim() || DEFAULT_QUERY,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit))) : DEFAULT_LIMIT,
    profile: path.resolve(valueFor("--profile") || DEFAULT_PROFILE),
    output: path.resolve(valueFor("--out") || DEFAULT_OUTPUT)
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

async function isCaptchaPage(page: Page) {
  const url = page.url().toLowerCase();
  const text = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return url.includes("captcha") || text.includes("captcha") || text.includes("unusual traffic");
}

async function collectVisiblePostLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href*="/comments/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map(canonicalRedditPostUrl).filter((href): href is string => Boolean(href)))];
}

async function waitForOperator() {
  const terminal = readline.createInterface({ input, output });
  await terminal.question("Check the visible Reddit search page, complete any normal login or CAPTCHA yourself, then press Enter to collect links. ");
  terminal.close();
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  await mkdir(path.dirname(options.profile), { recursive: true });
  await mkdir(path.dirname(options.output), { recursive: true });

  const context = await chromium.launchPersistentContext(options.profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 960 }
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(options.query)}&sort=new`, { waitUntil: "domcontentloaded" });
    await waitForOperator();
    if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. Complete it manually, then rerun the command.");

    const links = new Set<string>();
    for (let scroll = 0; scroll < 12 && links.size < options.limit; scroll += 1) {
      if (await isCaptchaPage(page)) throw new Error("Reddit presented a CAPTCHA or traffic check. The collector stopped without saving additional links.");
      for (const href of await collectVisiblePostLinks(page)) {
        links.add(href);
        if (links.size >= options.limit) break;
      }
      if (links.size >= options.limit) break;
      await page.mouse.wheel(0, 1100);
      await page.waitForTimeout(2200);
    }

    const result = [...links].slice(0, options.limit);
    await writeFile(options.output, `${result.join("\n")}${result.length ? "\n" : ""}`, "utf8");
    console.log(`Saved ${result.length} Reddit post links to ${options.output}`);
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
