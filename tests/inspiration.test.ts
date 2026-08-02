import assert from "node:assert/strict";
import test from "node:test";
import { buildEditorialBrief, draftSafetyNotes, selectRedditInspirationSignals } from "../worker/src/inspiration.js";

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
  assert.equal(selected.length, 6);
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

test("keeps the first signals within one student-problem cluster when possible", () => {
  const selected = selectRedditInspirationSignals([
    { id: "career-one", sourceType: "reddit", status: "approved", theme: "Career planning", audience: "NTU students", insight: "A practical way to start career preparation early.", tags: ["career"], createdAt: recent, updatedAt: recent },
    { id: "career-two", sourceType: "reddit", status: "approved", theme: "Internship planning", audience: "NTU students", insight: "Students want a smaller first step for internship preparation.", tags: ["internship"], createdAt: recent, updatedAt: recent },
    { id: "housing", sourceType: "reddit", status: "approved", theme: "Hall choices", audience: "NTU students", insight: "Students compare several accommodation concerns before deciding.", tags: ["housing"], createdAt: recent, updatedAt: recent }
  ], () => 0, Date.parse("2026-08-02T00:00:00.000Z"));
  assert.deepEqual(selected.slice(0, 2).map((signal) => signal.id), ["career-one", "career-two"]);
});

test("keeps a career editorial brief focused on a useful action plan", () => {
  const brief = buildEditorialBrief([{
    id: "career",
    sourceType: "reddit",
    status: "approved",
    theme: "Internship preparation",
    audience: "NTU Chinese students",
    insight: "Students want a clearer way to break career preparation into smaller actions.",
    tags: ["career", "internship"],
    createdAt: recent,
    updatedAt: recent
  }]);
  assert.equal(brief.cluster, "career");
  assert.equal(brief.format, "action-checklist");
  assert.ok(brief.actionSteps.length >= 3);
  assert.match(brief.sourceBoundary, /not.*factual/i);
});

test("flags community attribution and shallow drafts before operator review", () => {
  const unsafe = draftSafetyNotes("Reddit says the deadline is tomorrow.");
  assert.ok(unsafe.some((note) => note.includes("cite")));
  assert.ok(unsafe.some((note) => note.includes("three")));

  const structured = draftSafetyNotes("A short situation.\n1. Check the official page.\n2. List your documents.\n3. Set a reminder.");
  assert.deepEqual(structured, []);
});
