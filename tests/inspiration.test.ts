import assert from "node:assert/strict";
import test from "node:test";
import { buildEditorialBrief, draftDepthNotes, draftSafetyNotes, selectRedditInspirationSignals } from "../worker/src/inspiration.js";

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

test("requires two anonymized decision factors when evidence cards are available", () => {
  const brief = buildEditorialBrief([{ id: "academic", sourceType: "reddit", status: "approved", theme: "Course registration", audience: "NTU students", insight: "Students compare timetable and prerequisite constraints.", createdAt: recent, updatedAt: recent, evidence: { problem: "Course planning", considerations: ["把时间冲突、候补或排队等限制写进决策表", "把资格、先修或申请条件单独核对"], timeliness: "high", confidence: "community-pattern" } }]);
  assert.equal(draftDepthNotes("开学前先核对官方页面。\n1. 打开课程页。\n2. 问老师。\n3. 做决定。", brief).length > 0, true);
  assert.equal(draftDepthNotes("选课前，我会先把时间冲突、候补或排队等限制写进决策表。\n1. 先确认模块和学期。\n2. 再把资格、先修或申请条件单独核对。\n3. 最后回到官方页面确认变动。", brief).some((note) => note.includes("two selected")), false);
});

test("prefers evidence cards over legacy topic-only signals", () => {
  const selected = selectRedditInspirationSignals([
    { id: "legacy", sourceType: "reddit", status: "approved", theme: "Career", audience: "NTU students", insight: "A broad legacy topic signal for student planning.", createdAt: recent, updatedAt: recent },
    { id: "evidence", sourceType: "reddit", status: "approved", theme: "Course registration", audience: "NTU students", insight: "A derived student decision pattern with constraints.", createdAt: recent, updatedAt: recent, evidence: { problem: "Course planning", considerations: ["把时间冲突、候补或排队等限制写进决策表", "把资格、先修或申请条件单独核对"], timeliness: "high", confidence: "community-pattern" } }
  ], () => 0);
  assert.deepEqual(selected.map((signal) => signal.id), ["evidence"]);
});
