import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeContentStrategy } from "../server/src/analytics/contentStrategy.js";
import type { ContentStyle, MarketingPost, TargetSegment } from "../server/src/types.js";

function postFixture(style: ContentStyle, targetSegment: TargetSegment, views: number, inquiries: number): MarketingPost {
  return {
    id: `${style}-${targetSegment}`,
    title: "title",
    body: "body",
    tags: ["tag"],
    imageIdeas: ["image"],
    callToAction: "cta",
    status: "published",
    topic: {
      style,
      targetSegment,
      scene: "scene",
      angle: "angle",
      hook: "hook",
      localSignals: ["MRT"]
    },
    review: { score: 90, notes: ["ok"], approved: true },
    metrics: { views, likes: 5, saves: 3, comments: 1, follows: 1, inquiries },
    estimatedCostCny: 0,
    generator: "local-template",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

describe("summarizeContentStrategy", () => {
  it("summarizes measured posts and recommends the strongest style and segment", () => {
    const summary = summarizeContentStrategy([
      postFixture("story", "student_returning_china", 100, 8),
      postFixture("story", "lease_gap", 50, 4),
      postFixture("direct", "general", 200, 1)
    ]);

    assert.equal(summary.measuredPosts, 3);
    assert.equal(summary.bestStyle?.key, "story");
    assert.equal(summary.bestSegment?.key, "student_returning_china");
    assert.ok(summary.recommendation.includes("story"));
  });

  it("asks for more samples when too little performance data exists", () => {
    const summary = summarizeContentStrategy([postFixture("guide", "lease_gap", 0, 0)]);

    assert.equal(summary.measuredPosts, 0);
    assert.ok(summary.recommendation.includes("样本还少"));
  });
});
