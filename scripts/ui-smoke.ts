import { existsSync } from "node:fs";
import { chromium } from "playwright";

const appUrl = process.env.UI_SMOKE_URL ?? "http://127.0.0.1:5173";
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
].filter(Boolean) as string[];

function resolveChromePath() {
  return chromeCandidates.find((candidate) => existsSync(candidate));
}

function hasMojibake(text: string) {
  const suspiciousCodePoints = [0x951f, 0xfffd, 0x947d, 0x704f, 0x93c2, 0x9354, 0x7efe];
  return suspiciousCodePoints.some((codePoint) => text.includes(String.fromCodePoint(codePoint)));
}

function isIgnoredConsoleMessage(message: string) {
  return message.includes("[vite]") || message.includes("React DevTools");
}

const executablePath = resolveChromePath();
if (!executablePath) {
  console.error("No Chrome executable found. Set CHROME_PATH to run the UI smoke check.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleMessages: string[] = [];

page.on("console", (message) => {
  const entry = `${message.type()}: ${message.text()}`;
  if (!isIgnoredConsoleMessage(entry)) consoleMessages.push(entry);
});
page.on("pageerror", (error) => {
  consoleMessages.push(`pageerror: ${error.message}`);
});

try {
  const response = await page.goto(appUrl, { waitUntil: "networkidle", timeout: 15000 });
  const status = response?.status() ?? 0;
  const title = await page.title();
  const h1 = await page.locator("h1").first().textContent({ timeout: 10000 });
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  const issues: string[] = [];

  if (status !== 200) issues.push(`Expected HTTP 200, got ${status}.`);
  if (title !== "新加坡迷你仓小红书运营台") issues.push(`Unexpected page title: ${title}`);
  if (h1 !== "小红书运营台") issues.push(`Unexpected h1: ${h1}`);
  if (hasMojibake(`${title}\n${bodyText}`)) issues.push("Page contains mojibake-like characters.");
  if (consoleMessages.length > 0) issues.push(`Console messages: ${consoleMessages.join(" | ")}`);

  const result = {
    ok: issues.length === 0,
    url: appUrl,
    status,
    title,
    h1,
    issues
  };

  console.log(JSON.stringify(result, null, 2));
  if (issues.length > 0) process.exit(1);
} finally {
  await browser.close();
}
