import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planContentCalendar } from "../server/src/generation/contentCalendar.js";

describe("planContentCalendar", () => {
  it("plans dated topic slots for the requested range", () => {
    const calendar = planContentCalendar(3, new Date(Date.UTC(2026, 6, 5, 12)));

    assert.equal(calendar.length, 3);
    assert.equal(calendar[0].date, "2026-07-05");
    assert.equal(calendar[1].date, "2026-07-06");
    assert.equal(calendar[2].slot, 3);
    assert.ok(calendar[0].topic.scene.length > 0);
    assert.ok(calendar[0].objective.length > 0);
    assert.ok(calendar[0].suggestedFormat.length > 0);
  });

  it("keeps the range within the operating limit", () => {
    assert.equal(planContentCalendar(0).length, 1);
    assert.equal(planContentCalendar(40).length, 30);
  });
});
