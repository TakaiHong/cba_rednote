import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateGoLiveReadiness } from "../scripts/go-live-check.js";
import type { buildReadinessChecks } from "../scripts/readiness.js";

type ReadinessChecks = Awaited<ReturnType<typeof buildReadinessChecks>>;

function checksWithExternalEvidence(input: { preflight: boolean; publishedUrl: boolean }): ReadinessChecks {
  return [
    {
      name: "frontend command",
      ok: true,
      severity: "required",
      detail: "ok"
    },
    {
      name: "preflight evidence",
      ok: input.preflight,
      severity: "warning",
      detail: input.preflight ? "preflight ok" : "missing preflight"
    },
    {
      name: "published URL evidence",
      ok: input.publishedUrl,
      severity: "warning",
      detail: input.publishedUrl ? "published URL ok" : "missing published URL"
    }
  ];
}

describe("evaluateGoLiveReadiness", () => {
  it("treats external Xiaohongshu evidence as required for go-live", () => {
    const result = evaluateGoLiveReadiness(checksWithExternalEvidence({ preflight: false, publishedUrl: false }));

    assert.equal(result.ok, false);
    assert.deepEqual(result.requiredFailures, []);
    assert.deepEqual(result.missingExternalEvidence, ["preflight evidence", "published URL evidence"]);
  });

  it("passes when required checks and external evidence are present", () => {
    const result = evaluateGoLiveReadiness(checksWithExternalEvidence({ preflight: true, publishedUrl: true }));

    assert.equal(result.ok, true);
    assert.deepEqual(result.requiredFailures, []);
    assert.deepEqual(result.missingExternalEvidence, []);
  });
});
