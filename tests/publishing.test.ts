import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createXhsPublishPackage } from "../server/src/publishing/xhsPackage.js";
import type { MarketingPost } from "../server/src/types.js";

function postFixture(): MarketingPost {
  return {
    id: "post-1",
    title: "新加坡租房断档，东西可以这样先过渡",
    body: "旧房到期，新房还没好。\n\n东西可以先短租存放。",
    tags: ["新加坡生活", "#迷你仓", "租房断档"],
    imageIdeas: ["行李箱和纸箱"],
    callToAction: "私信物品清单，我帮你估空间。",
    status: "approved",
    topic: {
      style: "guide",
      targetSegment: "lease_gap",
      scene: "lease gap",
      angle: "storage bridge",
      hook: "old lease ended",
      localSignals: ["MRT"]
    },
    review: { score: 88, notes: ["ok"], approved: true },
    metrics: { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 },
    estimatedCostCny: 0,
    generator: "local-template",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

describe("createXhsPublishPackage", () => {
  it("formats title, body, call to action, and normalized tags", () => {
    const pkg = createXhsPublishPackage(postFixture());

    assert.equal(pkg.postId, "post-1");
    assert.equal(pkg.title, "新加坡租房断档，东西可以这样先过渡");
    assert.equal(pkg.tagsLine, "#新加坡生活 #迷你仓 #租房断档");
    assert.equal(pkg.coverText, "新加坡租房断档，东西可以这样先过渡");
    assert.ok(pkg.visualBrief.includes("封面文字"));
    assert.ok(pkg.imagePrompt.includes("Singapore mini storage"));
    assert.equal(pkg.assetChecklist.length >= 3, true);
    assert.ok(pkg.fullText.includes("旧房到期"));
    assert.ok(pkg.fullText.includes("私信物品清单"));
    assert.ok(pkg.fullText.endsWith("#新加坡生活 #迷你仓 #租房断档"));
  });
});
