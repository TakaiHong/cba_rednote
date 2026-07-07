import { pathToFileURL } from "node:url";
import { buildReadinessChecks } from "./readiness.js";

const externalEvidenceChecks = new Set(["preflight evidence", "published URL evidence"]);

export interface GoLiveCheckResult {
  ok: boolean;
  generatedAt: string;
  requiredFailures: string[];
  missingExternalEvidence: string[];
  checks: Awaited<ReturnType<typeof buildReadinessChecks>>;
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
