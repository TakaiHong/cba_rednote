import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type { GeneratedPost, MarketingPost } from "../types.js";
import { copyAgent, reviewAgent, topicAgent } from "./agents.js";
import { generateWithOpenAiCompatibleModel, reviseWithOpenAiCompatibleModel } from "./modelClient.js";
import { defaultSourceReferences, referencesForSourceIds, sourcePackForTopic } from "./officialSources.js";
import { checkDuplicatePost } from "./qualityGuard.js";
import { findUnsupportedFactSignals } from "./factSafety.js";

interface GenerationOptions {
  useModel?: boolean;
}

export async function generateMarketingPost(
  offset = Math.floor(Date.now() / 1000) % 997,
  options: GenerationOptions = {}
): Promise<MarketingPost> {
  const topic = topicAgent(offset);
  const sourcePack = sourcePackForTopic(topic);
  let generated: GeneratedPost = { ...copyAgent(topic), sourceIds: defaultSourceReferences().map((source) => source.id) };
  let generator: MarketingPost["generator"] = "local-template";

  if (options.useModel ?? true) {
    try {
      const modelPost = await generateWithOpenAiCompatibleModel(topic, sourcePack);
      if (modelPost) {
        generated = modelPost;
        generator = "openai-compatible";
      }
    } catch (error) {
      console.warn(`[generator] model fallback: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  generated = normalizeGeneratedPost(generated, topic);
  const review = reviewAgent(generated);
  review.approved = false;
  review.notes.unshift("Source-backed draft requires human fact verification before publishing.");
  const factSafetyIssues = findUnsupportedFactSignals(generated);
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    ...generated,
    status: "draft",
    topic,
    review,
    metrics: { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 },
    estimatedCostCny: generator === "openai-compatible" ? config.openAiModelCostCnyPerPostEstimate : 0,
    generator,
    sourceReferences: referencesForSourceIds(generated.sourceIds ?? []),
    factCheck:
      factSafetyIssues.length > 0
        ? { status: "blocked", notes: ["Blocked by fact safety guard.", ...factSafetyIssues] }
        : { status: "needs_review", notes: ["Verify each factual statement against the attached official sources."] },
    createdAt: now,
    updatedAt: now
  };
}

function normalizeGeneratedPost(generated: GeneratedPost, topic: ReturnType<typeof topicAgent>) {
  const fallback = copyAgent(topic);
  const tags = [...new Set([...generated.tags, ...fallback.tags].map((tag) => tag.trim()).filter(Boolean))].slice(0, 9);

  return {
    ...generated,
    tags,
    imageIdeas: generated.imageIdeas.length > 0 ? generated.imageIdeas : fallback.imageIdeas,
    callToAction: generated.callToAction.trim() || fallback.callToAction
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

export async function regenerateMarketingPost(post: MarketingPost, feedback: string): Promise<MarketingPost> {
  const sourcePack = post.sourceReferences?.length ? post.sourceReferences : sourcePackForTopic(post.topic);
  let generated: GeneratedPost = { ...copyAgent(post.topic), sourceIds: sourcePack.slice(0, 2).map((source) => source.id) };
  let generator: MarketingPost["generator"] = "local-template";

  try {
    const modelPost = await reviseWithOpenAiCompatibleModel(post, feedback, sourcePack);
    if (modelPost) {
      generated = modelPost;
      generator = "openai-compatible";
    }
  } catch (error) {
    console.warn(`[generator] revision model fallback: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  generated = normalizeGeneratedPost(generated, post.topic);
  const review = reviewAgent(generated);
  review.approved = false;
  review.notes.unshift("Source-backed draft requires human fact verification before publishing.");
  const factSafetyIssues = findUnsupportedFactSignals(generated);

  return {
    ...post,
    ...generated,
    status: "draft",
    review,
    estimatedCostCny: generator === "openai-compatible" ? config.openAiModelCostCnyPerPostEstimate : 0,
    generator,
    sourceReferences: sourcePack.filter((source) => (generated.sourceIds ?? []).includes(source.id)),
    factCheck:
      factSafetyIssues.length > 0
        ? { status: "blocked", notes: ["Blocked by fact safety guard.", ...factSafetyIssues] }
        : { status: "needs_review", notes: ["Content changed; re-verify every factual statement before publishing."] },
    revisionNotes: [...(post.revisionNotes ?? []), feedback],
    updatedAt: new Date().toISOString()
  };
}
