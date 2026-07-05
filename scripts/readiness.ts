import { access, readFile } from "node:fs/promises";
import { config } from "../server/src/config.js";
import { finalPublishGuardMessage, shouldAttemptFinalPublish } from "../server/src/publishing/finalPublish.js";
import { loadXhsSelectorConfig } from "../server/src/publishing/selectorConfig.js";
import { getSystemStatus } from "../server/src/status.js";

interface CheckResult {
  name: string;
  ok: boolean;
  severity: "required" | "warning";
  detail: string;
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

function formatStatus(ok: boolean, severity: CheckResult["severity"]) {
  if (ok) return "OK";
  return severity === "required" ? "FAIL" : "WARN";
}

async function main() {
  const status = await getSystemStatus();
  const selectors = await loadXhsSelectorConfig();
  const finalPublishEnabled = shouldAttemptFinalPublish(true, process.env);

  const checks: CheckResult[] = [
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
      ok: config.openAiModelCostCnyPerPostEstimate <= config.maxCostCnyPerPost,
      severity: "required",
      detail: `Estimated model cost ${config.openAiModelCostCnyPerPostEstimate} CNY <= max ${config.maxCostCnyPerPost} CNY.`
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
      name: "external account validation",
      ok: false,
      severity: "warning",
      detail: "Run publish:preflight in a real logged-in Xiaohongshu creator session before relying on final-click publishing."
    }
  ];

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

await main();
