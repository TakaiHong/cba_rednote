import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMarketingPost } from "../server/src/generation/generator.js";

describe("generateMarketingPost", () => {
  it("creates a budget-safe approved draft with XHS fields", async () => {
    const post = await generateMarketingPost(3, { useModel: false });

    assert.ok(post.id);
    assert.ok(post.title.length > 0);
    assert.ok(post.body.length > 50);
    assert.ok(post.tags.some((tag) => tag.includes("NTU") || tag.includes("新加坡")));
    assert.ok(post.tags.length >= 5);
    assert.ok(post.imageIdeas.length >= 1);
    assert.equal(post.estimatedCostCny <= 0.5, true);
    assert.equal(post.metrics.views, 0);
    assert.match(post.status, /draft|approved/);
  });
});
