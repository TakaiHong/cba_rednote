import { pathToFileURL } from "node:url";
import { buildReadinessChecks } from "./readiness.js";

const externalEvidenceChecks = new Set(["preflight evidence", "published URL evidence"]);

export interface GoLiveCheckResult {
  ok: boolean;
  generatedAt: string;
  requiredFailures: string[];
  missingExternalEvidence: string[];
  nextSteps: string[];
  checks: Awaited<ReturnType<typeof buildReadinessChecks>>;
}

function buildNextSteps(input: { requiredFailures: string[]; missingExternalEvidence: string[] }) {
  const steps: string[] = [];

  if (input.requiredFailures.length > 0) {
    steps.push("Run npm.cmd run readiness and fix required failures before real account validation.");
  }
  if (input.missingExternalEvidence.includes("preflight evidence")) {
    steps.push("Open the dashboard and click 账号预检 in a logged-in Xiaohongshu creator session; use npm.cmd run publish:preflight only as a CLI fallback.");
  }
  if (input.missingExternalEvidence.includes("published URL evidence")) {
    steps.push("After one reviewed manual publish, copy the Xiaohongshu note URL and click 粘贴链接并标记已发布 in the dashboard; use npm.cmd run publish -- --post <post-id> --mark-published --published-url <url> only as a CLI fallback.");
  }

  return steps;
}

export function evaluateGoLiveReadiness(checks: Awaited<ReturnType<typeof buildReadinessChecks>>): GoLiveCheckResult {
  const requiredFailures = checks
    .filter((check) => check.severity === "required" && !check.ok)
    .map((check) => check.name);
  const missingExternalEvidence = checks
    .filter((check) => externalEvidenceChecks.has(check.name) && !check.ok)
    .map((check) => check.name);

  return {
    ok: requiredFailures.length === 0 && missingExternalEvidence.length === 0,
    generatedAt: new Date().toISOString(),
    requiredFailures,
    missingExternalEvidence,
    nextSteps: buildNextSteps({ requiredFailures, missingExternalEvidence }),
    checks
  };
}

function formatLine(check: GoLiveCheckResult["checks"][number]) {
  const externalRequired = externalEvidenceChecks.has(check.name);
  const label = check.ok ? "OK" : externalRequired || check.severity === "required" ? "FAIL" : "WARN";
  const suffix = externalRequired ? " (go-live required)" : "";
  return `[${label}] ${check.name}${suffix}: ${check.detail}`;
}

export async function runGoLiveCheck() {
  const checks = await buildReadinessChecks();
  return evaluateGoLiveReadiness(checks);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runGoLiveCheck();

  console.log("Go-live checklist");
  for (const check of result.checks) {
    console.log(formatLine(check));
  }
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        requiredFailures: result.requiredFailures,
        missingExternalEvidence: result.missingExternalEvidence,
        nextSteps: result.nextSteps,
        generatedAt: result.generatedAt
      },
      null,
      2
    )
  );

  if (!result.ok) {
    process.exit(1);
  }
}
