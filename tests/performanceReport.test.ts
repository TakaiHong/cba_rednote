import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderPerformanceReport } from "../server/src/analytics/performanceReport.js";
import type { MarketingPost } from "../server/src/types.js";

function postFixture(input: Partial<MarketingPost>): MarketingPost {
  return {
    id: "post-1",
    title: "Lease gap storage story",
    body: "body",
    tags: ["mini storage"],
    imageIdeas: [],
    callToAction: "DM for list",
    status: "published",
    topic: {
      style: "story",
      targetSegment: "lease_gap",
      scene: "lease gap",
      angle: "store first",
      hook: "no new room yet",
      localSignals: ["Singapore"]
    },
    review: { score: 90, notes: [], approved: true },
    metrics: { views: 100, likes: 6, saves: 8, comments: 2, follows: 1, inquiries: 5 },
    estimatedCostCny: 0.12,
    generator: "local-template",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    publishedUrl: "https://www.xiaohongshu.com/explore/example",
    ...input
  };
}

describe("renderPerformanceReport", () => {
  it("summarizes measured post metrics for operator review", () => {
    const report = renderPerformanceReport([postFixture({})], new Date("2026-07-11T00:00:00.000Z"));

    assert.match(report, /Xiaohongshu Performance Report/);
    assert.match(report, /Total views: 100/);
    assert.match(report, /Total interactions: 17/);
    assert.match(report, /Total inquiries: 5/);
    assert.match(report, /Interaction rate: 17.00%/);
    assert.match(report, /Inquiry rate: 5.00%/);
    assert.match(report, /Lease gap storage story/);
  });

  it("tells operators what to backfill when no metrics exist", () => {
    const report = renderPerformanceReport([], new Date("2026-07-11T00:00:00.000Z"));

    assert.match(report, /No posts have metrics yet/);
    assert.match(report, /After 24 hours/);
    assert.match(report, /After 72 hours/);
  });
});
