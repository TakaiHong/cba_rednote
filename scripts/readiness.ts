import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { config } from "../server/src/config.js";
import { finalPublishGuardMessage, shouldAttemptFinalPublish } from "../server/src/publishing/finalPublish.js";
import { loadXhsSelectorConfig } from "../server/src/publishing/selectorConfig.js";
import { postStore } from "../server/src/storage/postStore.js";
import { getSystemStatus } from "../server/src/status.js";

interface CheckResult {
  name: string;
  ok: boolean;
  severity: "required" | "warning";
  detail: string;
}

interface SelectorEvidence {
  selector: string;
  count: number;
  visible: boolean;
}

interface PreflightReport {
  generatedAt?: string;
  selectors?: Partial<Record<"title" | "body" | "upload" | "publishButton", SelectorEvidence[]>>;
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function packageScriptExists(scriptName: string) {
  const raw = await readFile("package.json", "utf8");
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  return Boolean(pkg.scripts?.[scriptName]);
}

function selectorGroupHasVisibleHit(report: PreflightReport | undefined, group: keyof NonNullable<PreflightReport["selectors"]>) {
  return Boolean(report?.selectors?.[group]?.some((item) => item.count > 0 && item.visible));
}

export async function readPreflightEvidence(path = process.env.XHS_PREFLIGHT_REPORT ?? ".tmp/xhs-preflight-report.json") {
  try {
    const report = JSON.parse(await readFile(path, "utf8")) as PreflightReport;
    const requiredGroups = ["title", "body", "upload", "publishButton"] as const;
    const missingGroups = requiredGroups.filter((group) => !selectorGroupHasVisibleHit(report, group));
    return {
      ok: missingGroups.length === 0,
      detail:
        missingGroups.length === 0
          ? `Preflight report ${path} has visible selector hits for title, body, upload, and publishButton.`
          : `Preflight report ${path} is missing visible hits for: ${missingGroups.join(", ")}.`
    };
  } catch {
    return {
      ok: false,
      detail: `No usable preflight report found at ${path}. Run npm.cmd run publish:preflight in a real logged-in Xiaohongshu session.`
    };
  }
}

export async function readPublishedUrlEvidence() {
  const posts = await postStore.list();
  const publishedWithUrl = posts.filter((post) => post.status === "published" && Boolean(post.publishedUrl));
  return {
    ok: publishedWithUrl.length > 0,
    detail:
      publishedWithUrl.length > 0
        ? `${publishedWithUrl.length} published post(s) have a recorded Xiaohongshu URL.`
        : "No published Xiaohongshu URL has been recorded yet. Mark one reviewed note as published after the first real post."
  };
}

function formatStatus(ok: boolean, severity: CheckResult["severity"]) {
  if (ok) return "OK";
  return severity === "required" ? "FAIL" : "WARN";
}

export async function buildReadinessChecks(): Promise<CheckResult[]> {
  const status = await getSystemStatus();
  const selectors = await loadXhsSelectorConfig();
  const finalPublishEnabled = shouldAttemptFinalPublish(true, process.env);
  const preflightEvidence = await readPreflightEvidence();
  const publishedUrlEvidence = await readPublishedUrlEvidence();

  return [
    {
      name: "frontend command",
      ok: await packageScriptExists("dev:client"),
      severity: "required",
      detail: "React/Vite frontend command is present."
    },
    {
      name: "backend command",
      ok: await packageScriptExists("dev:server"),
      severity: "required",
      detail: "Express backend command is present."
    },
    {
      name: "daily generation command",
      ok:
        (await packageScriptExists("generate")) &&
        (await packageScriptExists("generate:batch")) &&
        (await packageScriptExists("calendar")) &&
        (await packageScriptExists("handoff")) &&
        (await packageScriptExists("schedule:install")),
      severity: "required",
      detail: "Single draft generation, batch generation, content calendar, handoff export, and Windows scheduled task installer are present."
    },
    {
      name: "publishing command",
      ok: (await packageScriptExists("publish")) && selectors.title.length > 0 && selectors.body.length > 0,
      severity: "required",
      detail: "Publish script and title/body selector groups are present."
    },
    {
      name: "final publish guard",
      ok: selectors.publishButton.length > 0,
      severity: "required",
      detail: `Publish button selectors configured. ${finalPublishEnabled ? "Final click opt-in is enabled." : finalPublishGuardMessage(true)}`
    },
    {
      name: "budget guard",
      ok: config.openAiModelCostCnyPerPostEstimate <= config.maxCostCnyPerPost && status.cost.withinPerPostBudget,
      severity: "required",
      detail: `Estimated model cost ${config.openAiModelCostCnyPerPostEstimate} CNY <= max ${config.maxCostCnyPerPost} CNY. Total recorded cost: ${status.cost.totalEstimatedCostCny} CNY.`
    },
    {
      name: "secret scan command",
      ok: await packageScriptExists("secrets:scan"),
      severity: "required",
      detail: "Tracked-file API key scan is available and runs during verify."
    },
    {
      name: "content pool",
      ok: status.counts.total > 0,
      severity: "warning",
      detail: `Content pool has ${status.counts.total} posts. Generate at least one draft before handoff.`
    },
    {
      name: "required docs",
      ok:
        (await fileExists("docs/requirements.md")) &&
        (await fileExists("docs/architecture.md")) &&
        (await fileExists("docs/code-map.md")) &&
        (await fileExists("docs/xiaohongshu-publishing.md")) &&
        (await fileExists("docs/operations-runbook.md")),
      severity: "required",
      detail: "Requirements, architecture, code map, publishing, and operations docs are present."
    },
    {
      name: "model provider",
      ok: status.config.modelProvider === "local-template" || status.config.modelConfigured,
      severity: "warning",
      detail: `Provider=${status.config.modelProvider}, model=${status.config.model}. Local template is acceptable when no API key is intended.`
    },
    {
      name: "preflight evidence",
      ok: preflightEvidence.ok,
      severity: "warning",
      detail: preflightEvidence.detail
    },
    {
      name: "published URL evidence",
      ok: publishedUrlEvidence.ok,
      severity: "warning",
      detail: publishedUrlEvidence.detail
    }
  ];
}

async function main() {
  const checks = await buildReadinessChecks();

  const failedRequired = checks.filter((check) => !check.ok && check.severity === "required");
  const warnings = checks.filter((check) => !check.ok && check.severity === "warning");

  console.log("Readiness checklist");
  for (const check of checks) {
    console.log(`[${formatStatus(check.ok, check.severity)}] ${check.name}: ${check.detail}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: failedRequired.length === 0,
        requiredFailures: failedRequired.length,
        warnings: warnings.length,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  if (failedRequired.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
