import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceCards } from "../scripts/build-reddit-evidence-cards.js";

test("builds derived evidence cards without retaining raw post content", () => {
  const rawBody = "I am user@example.com and my course registration has a timetable clash. Please contact me at 81234567.";
  const cards = buildEvidenceCards([JSON.stringify({ collectedAt: "2026-08-02T00:00:00.000Z", postUrl: "https://www.reddit.com/r/NTU/comments/abc/example/?utm=x", subreddit: "NTU", title: "course registration", body: rawBody, comments: ["The prerequisite also matters."] })], new Date("2026-08-03T00:00:00.000Z"));
  assert.equal(cards.length, 1);
  const serialized = JSON.stringify(cards[0]);
  assert.equal(serialized.includes("user@example.com"), false);
  assert.equal(serialized.includes("81234567"), false);
  assert.equal(serialized.includes(rawBody), false);
  assert.equal(cards[0].evidence.considerations.length >= 2, true);
  assert.equal(cards[0].theme, "NTU 选课与学业决策");
});
