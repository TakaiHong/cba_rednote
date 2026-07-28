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
  imageAssets?: string[];
  callToAction: string;
  sourceIds?: string[];
}

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  accessedAt: string;
  claims: string[];
}

export interface FactCheck {
  status: "needs_review" | "verified" | "blocked";
  notes: string[];
  checkedAt?: string;
}

export interface ReviewResult {
  score: number;
  notes: string[];
  approved: boolean;
}

export interface PostMetrics {
  views: number;
  likes: number;
  saves: number;
  comments: number;
  follows: number;
  inquiries: number;
}

export interface MarketingPost extends GeneratedPost {
  id: string;
  status: PostStatus;
  topic: TopicPlan;
  review: ReviewResult;
  metrics: PostMetrics;
  estimatedCostCny: number;
  generator: "local-template" | "openai-compatible";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedUrl?: string;
  revisionNotes?: string[];
  sourceReferences?: SourceReference[];
  factCheck?: FactCheck;
}

export interface CreatePostInput {
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  imageAssets?: string[];
  callToAction: string;
  status?: PostStatus;
  sourceReferences?: SourceReference[];
  factCheck?: FactCheck;
  metrics?: Partial<PostMetrics>;
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  tags?: string[];
  imageIdeas?: string[];
  imageAssets?: string[];
  callToAction?: string;
  status?: PostStatus;
  publishedUrl?: string;
  revisionNotes?: string[];
  sourceReferences?: SourceReference[];
  factCheck?: FactCheck;
  metrics?: Partial<PostMetrics>;
}

export interface RunLogEntry {
  id: string;
  action: string;
  status: "ok" | "error";
  message: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
}
