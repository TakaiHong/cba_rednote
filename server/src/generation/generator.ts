import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type { MarketingPost } from "../types.js";
import { copyAgent, reviewAgent, topicAgent } from "./agents.js";
import { generateWithOpenAiCompatibleModel } from "./modelClient.js";
import { checkDuplicatePost } from "./qualityGuard.js";

interface GenerationOptions {
  useModel?: boolean;
}

export async function generateMarketingPost(
  offset = Math.floor(Date.now() / 1000) % 997,
  options: GenerationOptions = {}
): Promise<MarketingPost> {
  const topic = topicAgent(offset);
  let generated = copyAgent(topic);
  let generator: MarketingPost["generator"] = "local-template";

  if (options.useModel ?? true) {
    try {
      const modelPost = await generateWithOpenAiCompatibleModel(topic);
      if (modelPost) {
        generated = modelPost;
        generator = "openai-compatible";
      }
    } catch (error) {
      console.warn(`[generator] model fallback: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const review = reviewAgent(generated);
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    ...generated,
    status: review.approved ? "approved" : "draft",
    topic,
    review,
    metrics: { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 },
    estimatedCostCny: generator === "openai-compatible" ? config.openAiModelCostCnyPerPostEstimate : 0,
    generator,
    createdAt: now,
    updatedAt: now
  };
}

export async function generateUniqueMarketingPost(
  existingPosts: MarketingPost[],
  baseOffset = 0,
  maxAttempts = 8,
  options: GenerationOptions = {}
) {
  let bestPost: MarketingPost | undefined;
  let bestSimilarity = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const post = await generateMarketingPost(baseOffset + attempt, options);
    const similarity = checkDuplicatePost(post, existingPosts);

    if (!similarity.duplicate) {
      post.review.notes.push(`Similarity guard passed. Max similarity: ${similarity.maxSimilarity}.`);
      return post;
    }

    if (similarity.maxSimilarity < bestSimilarity) {
      bestSimilarity = similarity.maxSimilarity;
      bestPost = post;
      bestPost.review.notes.push(
        `Similarity guard fallback candidate. Max similarity: ${similarity.maxSimilarity} against ${similarity.matchedPostId}.`
      );
    }
  }

  if (!bestPost) return generateMarketingPost(baseOffset, options);
  bestPost.status = "draft";
  bestPost.review.approved = false;
  bestPost.review.notes.push("Needs manual review: all generated candidates were similar to previous posts.");
  return bestPost;
}
