import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { planBatchGeneration } from "../server/src/generation/batch.js";
import { planContentCalendar, renderCalendarMarkdown } from "../server/src/generation/contentCalendar.js";
import { createXhsPublishPackage, renderXhsMarkdownExport } from "../server/src/publishing/xhsPackage.js";
import { getSystemStatus } from "../server/src/status.js";
import { postStore } from "../server/src/storage/postStore.js";
import { runLogStore } from "../server/src/storage/runLogStore.js";
import { evaluateGoLiveReadiness } from "./go-live-check.js";
import { prepareImageAssetBrief } from "./prepare-image-assets.js";
import { buildReadinessChecks } from "./readiness.js";

export interface HandoffOptions {
  outDir: string;
}

function parseArgs(argv: string[]): HandoffOptions {
  const outArgIndex = argv.findIndex((arg) => arg === "--out");
  return {
    outDir: outArgIndex >= 0 ? argv[outArgIndex + 1] : ".tmp/handoff"
  };
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
}

function renderSummary(input: {
  status: Awaited<ReturnType<typeof getSystemStatus>>;
  readinessChecks: Awaited<ReturnType<typeof buildReadinessChecks>>;
  goLiveCheck: ReturnType<typeof evaluateGoLiveReadiness>;
  latestExportPath?: string;
  imageAssetPaths?: string[];
  firstPublishChecklistPath: string;
  calendarPath: string;
  batchDryRunPath: string;
}) {
  return [
    "# Singapore Mini Storage XHS Handoff",
    "",
    `Generated at: ${input.status.generatedAt}`,
    "",
    "## Runtime Status",
    "",
    `- Service: ${input.status.service}`,
    `- Posts: total=${input.status.counts.total}, approved=${input.status.counts.approved}, published=${input.status.counts.published}`,
    `- Model provider: ${input.status.config.modelProvider}`,
    `- Model configured: ${input.status.config.modelConfigured}`,
    `- Max cost per post: ${input.status.config.maxCostCnyPerPost} CNY`,
    `- Total estimated content cost: ${input.status.cost.totalEstimatedCostCny} CNY`,
    `- Average estimated content cost: ${input.status.cost.averageEstimatedCostCny} CNY`,
    `- Paid model posts: ${input.status.cost.paidModelPosts}`,
    `- Within per-post budget: ${input.status.cost.withinPerPostBudget}`,
    "",
    "## Strategy",
    "",
    input.status.strategy.recommendation,
    "",
    "## Recent Runs",
    "",
    ...(input.status.recentRuns.length
      ? input.status.recentRuns.map((run) => `- ${run.createdAt} [${run.status}] ${run.action}: ${run.message}`)
      : ["- No recent run records yet."]),
    "",
    "## Readiness Checks",
    "",
    ...input.readinessChecks.map((check) => `- ${check.ok ? "OK" : check.severity.toUpperCase()} ${check.name}: ${check.detail}`),
    "",
    "## Go-Live Check",
    "",
    `- Ready for go-live: ${input.goLiveCheck.ok}`,
    `- Missing external evidence: ${input.goLiveCheck.missingExternalEvidence.join(", ") || "none"}`,
    `- Required failures: ${input.goLiveCheck.requiredFailures.join(", ") || "none"}`,
    "",
    "### Next Steps",
    "",
    ...(input.goLiveCheck.nextSteps.length ? input.goLiveCheck.nextSteps.map((step) => `- ${step}`) : ["- No go-live blockers found."]),
    "",
    "## Files",
    "",
    `- Status JSON: status.json`,
    `- Readiness JSON: readiness-checks.json`,
    `- Go-live JSON: go-live-check.json`,
    `- First publish checklist: ${input.firstPublishChecklistPath}`,
    `- Content calendar: ${input.calendarPath}`,
    `- Batch dry-run: ${input.batchDryRunPath}`,
    `- Latest publish package: ${input.latestExportPath ?? "not available"}`,
    `- Image asset brief: ${input.imageAssetPaths?.join(", ") ?? "not available"}`,
    ""
  ].join("\n");
}

function renderFirstPublishChecklist(input: {
  goLiveCheck: ReturnType<typeof evaluateGoLiveReadiness>;
  latest?: Awaited<ReturnType<typeof postStore.latestDraft>>;
  latestExportPath?: string;
  imageAssetPaths?: string[];
}) {
  const latest = input.latest;
  return [
    "# First Xiaohongshu Publish Checklist",
    "",
    "Use this checklist for the first real account publish. Keep final-click publishing disabled until the account preflight and one manual publish are proven.",
    "",
    "## Current Post",
    "",
    latest
      ? `- Post id: ${latest.id}`
      : "- Post id: none available. Generate and approve one draft before publishing.",
    latest
      ? `- Title: ${latest.title}`
      : "- Title: none",
    latest
      ? `- Status: ${latest.status}`
      : "- Status: none",
    `- Latest publish package: ${input.latestExportPath ?? "not available"}`,
    `- Image handoff files: ${input.imageAssetPaths?.join(", ") ?? "not available"}`,
    "",
    "## Before Opening Xiaohongshu",
    "",
    "- Run `npm.cmd run health` and confirm backend/frontend are online.",
    "- Run `npm.cmd run readiness` and fix any required failures.",
    "- Generate or attach images with `npm.cmd run image:cover -- --post latest --attach`, or place real photos in an ignored local folder.",
    "- Export the copy package with `npm.cmd run export -- --post latest` if a human publisher needs a separate Markdown file.",
    "",
    "## Real Account Preflight",
    "",
    "- Run `npm.cmd run publish:preflight`.",
    "- Log in to the opened Xiaohongshu creator center if needed.",
    "- Confirm the report at `.tmp/xhs-preflight-report.json` has visible hits for `title`, `body`, `upload`, and `publishButton`.",
    "- If selectors are missing, update `config/xhs-selectors.json`, then run preflight again.",
    "",
    "## Assisted Publish",
    "",
    "- Run `npm.cmd run publish -- --post latest --images-dir .\\assets\\xhs` if using an image folder.",
    "- Check title, body, tags, cover, image order, and any Xiaohongshu warning before publishing.",
    "- Publish manually from the browser for the first proven run.",
    "",
    "## After Publish",
    "",
    "- Copy the final Xiaohongshu note URL.",
    "- Paste it into the dashboard's publish URL field and mark the post as published, or run:",
    latest
      ? `  \`npm.cmd run publish -- --post ${latest.id} --mark-published --published-url <url>\``
      : "  `npm.cmd run publish -- --post <post-id> --mark-published --published-url <url>`",
    "- Run `npm.cmd run go-live:check`.",
    "- Keep the handoff folder, preflight report, published URL, and `npm.cmd run verify` output as launch evidence.",
    "",
    "## Current Go-Live Status",
    "",
    `- Ready for go-live: ${input.goLiveCheck.ok}`,
    `- Missing external evidence: ${input.goLiveCheck.missingExternalEvidence.join(", ") || "none"}`,
    ...(input.goLiveCheck.nextSteps.length
      ? ["", "## Next Steps", "", ...input.goLiveCheck.nextSteps.map((step) => `- ${step}`)]
      : []),
    ""
  ].join("\n");
}

export async function generateHandoffPackage(options: HandoffOptions) {
  const outDir = join(process.cwd(), options.outDir);
  await mkdir(outDir, { recursive: true });

  const status = await getSystemStatus();
  await writeFile(join(outDir, "status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");

  const readinessChecks = await buildReadinessChecks();
  await writeFile(join(outDir, "readiness-checks.json"), `${JSON.stringify(readinessChecks, null, 2)}\n`, "utf8");
  const goLiveCheck = evaluateGoLiveReadiness(readinessChecks);
  await writeFile(join(outDir, "go-live-check.json"), `${JSON.stringify(goLiveCheck, null, 2)}\n`, "utf8");

  const calendar = planContentCalendar(7);
  const calendarFile = "content-calendar.md";
  await writeFile(join(outDir, calendarFile), renderCalendarMarkdown(calendar), "utf8");

  const batchPlan = planBatchGeneration({ count: 7, maxModelPosts: 1 });
  const batchDryRunFile = "batch-generation-dry-run.json";
  await writeFile(join(outDir, batchDryRunFile), `${JSON.stringify(batchPlan, null, 2)}\n`, "utf8");

  let latestExportPath: string | undefined;
  let imageAssetPaths: string[] | undefined;
  const latest = await postStore.latestDraft();
  if (latest) {
    const publishPackage = createXhsPublishPackage(latest);
    const filename = `${latest.createdAt.slice(0, 10)}-${safeFilename(publishPackage.title) || latest.id}.md`;
    latestExportPath = filename;
    await writeFile(join(outDir, filename), renderXhsMarkdownExport(publishPackage), "utf8");

    const imageAssets = await prepareImageAssetBrief({
      post: latest.id,
      outDir: join(options.outDir, "image-assets")
    });
    imageAssetPaths = Object.values(imageAssets.files).map((file) => `image-assets/${file}`);
  }

  const firstPublishChecklistFile = "first-publish-checklist.md";
  await writeFile(
    join(outDir, firstPublishChecklistFile),
    renderFirstPublishChecklist({
      goLiveCheck,
      latest,
      latestExportPath,
      imageAssetPaths
    }),
    "utf8"
  );

  await writeFile(
    join(outDir, "handoff-summary.md"),
    renderSummary({
      status,
      readinessChecks,
      goLiveCheck,
      latestExportPath,
      imageAssetPaths,
      firstPublishChecklistPath: firstPublishChecklistFile,
      calendarPath: calendarFile,
      batchDryRunPath: batchDryRunFile
    }),
    "utf8"
  );

  await runLogStore.append({
    action: "handoff",
    status: "ok",
    message: "Generated handoff package",
    metadata: {
      outDir: options.outDir,
      hasLatestExport: Boolean(latestExportPath),
      hasImageAssetBrief: Boolean(imageAssetPaths),
      goLiveReady: goLiveCheck.ok
    }
  });

  return {
    outDir,
    files: {
      status: "status.json",
      readiness: "readiness-checks.json",
      goLive: "go-live-check.json",
      firstPublishChecklist: firstPublishChecklistFile,
      calendar: calendarFile,
      batchDryRun: batchDryRunFile,
      summary: "handoff-summary.md",
      latestExport: latestExportPath,
      imageAssets: imageAssetPaths
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await generateHandoffPackage(parseArgs(process.argv.slice(2)));
  console.log(result.outDir);
}
