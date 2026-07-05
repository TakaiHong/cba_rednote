export type PostStatus = "draft" | "approved" | "published" | "archived";

export type ContentStyle =
  | "story"
  | "guide"
  | "pitfall"
  | "checklist"
  | "comparison"
  | "direct"
  | "comment";

export type TargetSegment =
  | "student_returning_china"
  | "worker_returning_china"
  | "lease_gap"
  | "large_items"
  | "renovation"
  | "general";

export interface TopicPlan {
  style: ContentStyle;
  targetSegment: TargetSegment;
  scene: string;
  angle: string;
  hook: string;
  localSignals: string[];
}

export interface GeneratedPost {
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  callToAction: string;
}

export interface ReviewResult {
  score: number;
  notes: string[];
  approved: boolean;
}

export interface MarketingPost extends GeneratedPost {
  id: string;
  status: PostStatus;
  topic: TopicPlan;
  review: ReviewResult;
  estimatedCostCny: number;
  generator: "local-template" | "openai-compatible";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedUrl?: string;
}

export interface CreatePostInput {
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  callToAction: string;
  status?: PostStatus;
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  tags?: string[];
  imageIdeas?: string[];
  callToAction?: string;
  status?: PostStatus;
  publishedUrl?: string;
}
