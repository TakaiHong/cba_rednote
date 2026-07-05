import { config } from "../config.js";
import type { MarketingPost } from "../types.js";
import { generateUniqueMarketingPost } from "./generator.js";

export interface BatchGenerationOptions {
  count: number;
  maxModelPosts?: number;
}

export interface BatchGenerationPlan {
  count: number;
  modelConfigured: boolean;
  estimatedMaxCostCny: number;
  maxModelPosts: number;
}

export function planBatchGeneration(options: BatchGenerationOptions): BatchGenerationPlan {
  const requestedCount = Number.isFinite(options.count) ? options.count : 7;
  const requestedMaxModelPosts = Number.isFinite(options.maxModelPosts) ? (options.maxModelPosts ?? 1) : 1;
  const count = Math.max(1, Math.min(Math.floor(requestedCount), 14));
  const modelConfigured = Boolean(config.openAiApiKey);
  const maxModelPosts = Math.max(0, Math.min(Math.floor(requestedMaxModelPosts), count));
  const paidPosts = modelConfigured ? maxModelPosts : 0;

  return {
    count,
    modelConfigured,
    estimatedMaxCostCny: Number((paidPosts * config.openAiModelCostCnyPerPostEstimate).toFixed(4)),
    maxModelPosts
  };
}

export async function generatePostBatch(existingPosts: MarketingPost[], options: BatchGenerationOptions) {
  const plan = planBatchGeneration(options);
  const generatedPosts: MarketingPost[] = [];
  const workingPosts = [...existingPosts];

  for (let index = 0; index < plan.count; index += 1) {
    const post = await generateUniqueMarketingPost(workingPosts, workingPosts.length + index, 8, {
      useModel: index < plan.maxModelPosts
    });
    workingPosts.unshift(post);
    generatedPosts.push(post);
  }

  return { plan, posts: generatedPosts };
}
