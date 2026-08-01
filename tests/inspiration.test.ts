import assert from "node:assert/strict";
import test from "node:test";
import { selectRedditInspirationSignals } from "../worker/src/inspiration.js";

const recent = "2026-08-01T00:00:00.000Z";
const old = "2026-05-01T00:00:00.000Z";

test("selects only approved Reddit signals and returns a small unique set", () => {
  const signals = Array.from({ length: 8 }, (_, index) => ({
    id: "reddit-" + index,
    sourceType: "reddit" as const,
    status: "approved" as const,
    theme: "Theme " + index,
    audience: "NTU students",
    insight: "A safe paraphrased community topic signal.",
    createdAt: recent,
    updatedAt: recent
  }));
  signals.push({ ...signals[0], id: "pending", status: "pending_review" });
  const selected = selectRedditInspirationSignals(signals, () => 0.2, Date.parse("2026-08-02T00:00:00.000Z"));
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((signal) => signal.id)).size, selected.length);
  assert.ok(selected.every((signal) => signal.status === "approved"));
});

test("weights recent signals above stale signals", () => {
  const selected = selectRedditInspirationSignals([
    { id: "recent", sourceType: "reddit", status: "approved", theme: "Recent", audience: "NTU students", insight: "A safe paraphrased community topic signal.", createdAt: recent, updatedAt: recent },
    { id: "old", sourceType: "reddit", status: "approved", theme: "Old", audience: "NTU students", insight: "A safe paraphrased community topic signal.", createdAt: old, updatedAt: old },
    { id: "recent-two", sourceType: "reddit", status: "approved", theme: "Recent two", audience: "NTU students", insight: "A safe paraphrased community topic signal.", createdAt: recent, updatedAt: recent }
  ], () => 0, Date.parse("2026-08-02T00:00:00.000Z"));
  assert.equal(selected[0].id, "recent");
});
