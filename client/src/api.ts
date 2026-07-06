export type PostStatus = "draft" | "approved" | "published" | "archived";

export interface MarketingPost {
  id: string;
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  callToAction: string;
  status: PostStatus;
  topic: {
    style: string;
    targetSegment: string;
    scene: string;
    angle: string;
    hook: string;
    localSignals: string[];
  };
  review: {
    score: number;
    notes: string[];
    approved: boolean;
  };
  metrics: {
    views: number;
    likes: number;
    saves: number;
    comments: number;
    follows: number;
    inquiries: number;
  };
  estimatedCostCny: number;
  generator: string;
  createdAt: string;
  updatedAt: string;
  publishedUrl?: string;
}

export interface XhsPublishPackage {
  postId: string;
  title: string;
  body: string;
  tagsLine: string;
  imageIdeas: string[];
  coverText: string;
  visualBrief: string;
  imagePrompt: string;
  assetChecklist: string[];
  fullText: string;
}

export interface StrategyBucket {
  key: string;
  posts: number;
  views: number;
  interactions: number;
  inquiries: number;
  interactionRate: number;
  inquiryRate: number;
}

export interface ContentStrategySummary {
  sampleSize: number;
  measuredPosts: number;
  bestStyle?: StrategyBucket;
  bestSegment?: StrategyBucket;
  styleBuckets: StrategyBucket[];
  segmentBuckets: StrategyBucket[];
  recommendation: string;
}

export interface CalendarItem {
  date: string;
  slot: number;
  topic: {
    style: string;
    targetSegment: string;
    scene: string;
    angle: string;
    hook: string;
    localSignals: string[];
  };
  objective: string;
  suggestedFormat: string;
}

export interface SystemStatus {
  ok: boolean;
  strategy: ContentStrategySummary;
  cost: {
    totalEstimatedCostCny: number;
    averageEstimatedCostCny: number;
    paidModelPosts: number;
    withinPerPostBudget: boolean;
  };
  recentRuns: Array<{
    id: string;
    action: string;
    status: "ok" | "error";
    message: string;
    createdAt: string;
    metadata?: Record<string, string | number | boolean | undefined>;
  }>;
}

export interface BatchGenerationResult {
  plan: {
    count: number;
    modelConfigured: boolean;
    estimatedMaxCostCny: number;
    maxModelPosts: number;
  };
  posts: MarketingPost[];
}

const apiBase = "http://127.0.0.1:8787/api";

export async function listPosts() {
  const response = await fetch(`${apiBase}/posts`);
  if (!response.ok) throw new Error("Failed to load posts");
  return (await response.json()) as MarketingPost[];
}

export async function generatePost() {
  const response = await fetch(`${apiBase}/posts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) throw new Error("Failed to generate post");
  return (await response.json()) as MarketingPost;
}

export async function generatePostBatch(count = 7, maxModelPosts = 1) {
  const response = await fetch(`${apiBase}/posts/generate-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count, maxModelPosts })
  });
  if (!response.ok) throw new Error("Failed to generate post batch");
  return (await response.json()) as BatchGenerationResult;
}

export async function updatePost(id: string, patch: Partial<MarketingPost>) {
  const response = await fetch(`${apiBase}/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error("Failed to update post");
  return (await response.json()) as MarketingPost;
}

export async function getPublishPackage(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/publish-package`);
  if (!response.ok) throw new Error("Failed to load publish package");
  return (await response.json()) as XhsPublishPackage;
}

export async function getStatus() {
  const response = await fetch(`${apiBase}/status`);
  if (!response.ok) throw new Error("Failed to load status");
  return (await response.json()) as SystemStatus;
}

export async function getContentCalendar(days = 7) {
  const response = await fetch(`${apiBase}/posts/calendar/plan?days=${days}`);
  if (!response.ok) throw new Error("Failed to load content calendar");
  return (await response.json()) as CalendarItem[];
}
