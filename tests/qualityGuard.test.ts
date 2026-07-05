import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDuplicatePost, postSimilarity } from "../server/src/generation/qualityGuard.js";
import type { MarketingPost } from "../server/src/types.js";

function existingPost(title: string, body: string): MarketingPost {
  return {
    id: "existing-1",
    title,
    body,
    tags: ["tag"],
    imageIdeas: ["image"],
    callToAction: "cta",
    status: "approved",
    topic: {
      style: "guide",
      targetSegment: "lease_gap",
      scene: "scene",
      angle: "angle",
      hook: "hook",
      localSignals: ["MRT"]
    },
    review: { score: 90, notes: [], approved: true },
    metrics: { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 },
    estimatedCostCny: 0,
    generator: "local-template",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

describe("qualityGuard", () => {
  it("detects highly similar posts", () => {
    const post = existingPost("新加坡租房断档，东西可以这样先过渡", "旧房到期，新房还没好，东西可以先短租存放。");
    const result = checkDuplicatePost(
      { title: "新加坡租房断档，东西可以这样先过渡", body: "旧房到期，新房还没好，东西可以先短租存放。" },
      [post],
      0.72
    );

    assert.equal(result.duplicate, true);
    assert.equal(result.matchedPostId, "existing-1");
  });

  it("keeps unrelated posts below the duplicate threshold", () => {
    const score = postSimilarity(
      { title: "回国前 7 天行李清单", body: "先分证件和电脑，再处理床品、显示器和厨房用品。" },
      existingPost("新加坡租房断档，东西可以这样先过渡", "旧房到期，新房还没好，东西可以先短租存放。")
    );

    assert.equal(score < 0.72, true);
  });
});
