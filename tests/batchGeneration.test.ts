import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planBatchGeneration } from "../server/src/generation/batch.js";
import { generateMarketingPost } from "../server/src/generation/generator.js";

describe("batch generation", () => {
  it("caps generated draft count and model usage", () => {
    const plan = planBatchGeneration({ count: 40, maxModelPosts: 99 });

    assert.equal(plan.count, 14);
    assert.equal(plan.maxModelPosts, 14);
    assert.equal(plan.estimatedMaxCostCny >= 0, true);
  });

  it("supports local-only generation for batch safety", async () => {
    const post = await generateMarketingPost(2, { useModel: false });

    assert.equal(post.generator, "local-template");
    assert.equal(post.estimatedCostCny, 0);
    assert.ok(post.title.length > 0);
  });
});
