import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type { MarketingPost } from "../types.js";
import { copyAgent, reviewAgent, topicAgent } from "./agents.js";
import { generateWithOpenAiCompatibleModel } from "./modelClient.js";

export async function generateMarketingPost(offset = Math.floor(Date.now() / 1000) % 997): Promise<MarketingPost> {
  const topic = topicAgent(offset);
  let generated = copyAgent(topic);
  let generator: MarketingPost["generator"] = "local-template";

  try {
    const modelPost = await generateWithOpenAiCompatibleModel(topic);
    if (modelPost) {
      generated = modelPost;
      generator = "openai-compatible";
    }
  } catch (error) {
    console.warn(`[generator] model fallback: ${error instanceof Error ? error.message : "unknown error"}`);
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
