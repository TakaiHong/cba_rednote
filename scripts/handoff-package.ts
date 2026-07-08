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
    `- Content calendar: ${input.calendarPath}`,
    `- Batch dry-run: ${input.batchDryRunPath}`,
    `- Latest publish package: ${input.latestExportPath ?? "not available"}`,
    `- Image asset brief: ${input.imageAssetPaths?.join(", ") ?? "not available"}`,
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

  await writeFile(
    join(outDir, "handoff-summary.md"),
    renderSummary({
      status,
      readinessChecks,
      goLiveCheck,
      latestExportPath,
      imageAssetPaths,
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
