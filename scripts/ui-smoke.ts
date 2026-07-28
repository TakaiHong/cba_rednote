import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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
let exitCode = 0;

page.on("console", (message) => {
  const entry = `${message.type()}: ${message.text()}`;
  if (!isIgnoredConsoleMessage(entry)) consoleMessages.push(entry);
});
page.on("pageerror", (error) => {
  consoleMessages.push(`pageerror: ${error.message}`);
});

try {
  const response = await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  const status = response?.status() ?? 0;
  const title = await page.title();
  const h1 = await page.locator("h1").first().textContent({ timeout: 10000 });
  await page.getByTestId("nav-guide").click();
  const makeStepCount = await page.locator(".make-guide li").count();
  await page.getByTestId("nav-publish").click();
  const publishPostCount = await page.locator(".publish-post").count();
  await page.getByTestId("nav-operations").click();
  const fillOnlyButtonCount = await page.getByTestId("assisted-publish").count();
  await page.getByTestId("nav-calendar").click();
  const calendarItemCount = await page.locator(".calendar-view .calendar-item").count();
  await page.getByTestId("nav-guide").click();
  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  const issues: string[] = [];

  if (status !== 200) issues.push(`Expected HTTP 200, got ${status}.`);
  if (title !== "NTU CBA 华商会小红书运营台") issues.push(`Unexpected page title: ${title}`);
  if (h1 !== "小红书运营台") issues.push(`Unexpected h1: ${h1}`);
  if (fillOnlyButtonCount < 1) issues.push("Missing fill-only publish action.");
  if (makeStepCount !== 3) issues.push(`Expected three making steps, got ${makeStepCount}.`);
  if (publishPostCount < 1) issues.push("Publish queue is missing after switching tabs.");
  if (calendarItemCount < 1) issues.push("Content calendar is missing after switching tabs.");
  if (hasMojibake(`${title}\n${bodyText}`)) issues.push("Page contains mojibake-like characters.");
  if (consoleMessages.length > 0) issues.push(`Console messages: ${consoleMessages.join(" | ")}`);

  await mkdir(".tmp", { recursive: true });
  await page.screenshot({ path: ".tmp/ui-smoke.png", fullPage: true });

  const result = {
    ok: issues.length === 0,
    url: appUrl,
    status,
    title,
    h1,
    makeStepCount,
    publishPostCount,
    screenshot: ".tmp/ui-smoke.png",
    issues
  };

  console.log(JSON.stringify(result, null, 2));
  if (issues.length > 0) exitCode = 1;
} finally {
  await Promise.race([
    browser.close().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 3000))
  ]);
}

process.exitCode = exitCode;
