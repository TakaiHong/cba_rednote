import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { planBatchGeneration } from "../server/src/generation/batch.js";
import { planContentCalendar, renderCalendarMarkdown } from "../server/src/generation/contentCalendar.js";
import { createXhsPublishPackage, renderXhsMarkdownExport } from "../server/src/publishing/xhsPackage.js";
import { getSystemStatus } from "../server/src/status.js";
import { postStore } from "../server/src/storage/postStore.js";

interface Options {
  outDir: string;
}

function parseArgs(argv: string[]): Options {
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
  latestExportPath?: string;
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
    "",
    "## Strategy",
    "",
    input.status.strategy.recommendation,
    "",
    "## Files",
    "",
    `- Status JSON: status.json`,
    `- Content calendar: ${input.calendarPath}`,
    `- Batch dry-run: ${input.batchDryRunPath}`,
    `- Latest publish package: ${input.latestExportPath ?? "not available"}`,
    "",
    "## Remaining External Validation",
    "",
    "- Run `npm.cmd run publish:preflight` in a real logged-in Xiaohongshu creator session.",
    "- Review `.tmp/xhs-preflight-report.json` and confirm title/body/upload/publishButton selectors.",
    "- After the first manual publish, record the note URL in the dashboard or with `--mark-published`.",
    ""
  ].join("\n");
}

const options = parseArgs(process.argv.slice(2));
const outDir = join(process.cwd(), options.outDir);
await mkdir(outDir, { recursive: true });

const status = await getSystemStatus();
await writeFile(join(outDir, "status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");

const calendar = planContentCalendar(7);
const calendarFile = "content-calendar.md";
await writeFile(join(outDir, calendarFile), renderCalendarMarkdown(calendar), "utf8");

const batchPlan = planBatchGeneration({ count: 7, maxModelPosts: 1 });
const batchDryRunFile = "batch-generation-dry-run.json";
await writeFile(join(outDir, batchDryRunFile), `${JSON.stringify(batchPlan, null, 2)}\n`, "utf8");

let latestExportPath: string | undefined;
const latest = await postStore.latestDraft();
if (latest) {
  const publishPackage = createXhsPublishPackage(latest);
  const filename = `${latest.createdAt.slice(0, 10)}-${safeFilename(publishPackage.title) || latest.id}.md`;
  latestExportPath = filename;
  await writeFile(join(outDir, filename), renderXhsMarkdownExport(publishPackage), "utf8");
}

await writeFile(
  join(outDir, "handoff-summary.md"),
  renderSummary({
    status,
    latestExportPath,
    calendarPath: calendarFile,
    batchDryRunPath: batchDryRunFile
  }),
  "utf8"
);

console.log(outDir);
