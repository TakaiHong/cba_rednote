import type { GeneratedPost, MarketingPost } from "../types.js";

export interface SimilarityResult {
  duplicate: boolean;
  maxSimilarity: number;
  matchedPostId?: string;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function bigrams(text: string) {
  const normalized = normalize(text);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  const grams = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

export function postSimilarity(candidate: Pick<GeneratedPost, "title" | "body">, existing: Pick<MarketingPost, "title" | "body">) {
  const titleScore = jaccard(bigrams(candidate.title), bigrams(existing.title));
  const bodyScore = jaccard(bigrams(candidate.body), bigrams(existing.body));
  return Number((titleScore * 0.45 + bodyScore * 0.55).toFixed(4));
}

export function checkDuplicatePost(
  candidate: Pick<GeneratedPost, "title" | "body">,
  existingPosts: Array<Pick<MarketingPost, "id" | "title" | "body">>,
  threshold = 0.72
): SimilarityResult {
  let maxSimilarity = 0;
  let matchedPostId: string | undefined;

  for (const post of existingPosts) {
    const score = postSimilarity(candidate, post);
    if (score > maxSimilarity) {
      maxSimilarity = score;
      matchedPostId = post.id;
    }
  }

  return {
    duplicate: maxSimilarity >= threshold,
    maxSimilarity,
    matchedPostId
  };
}
