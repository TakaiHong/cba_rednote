export type PostStatus = "draft" | "approved" | "published" | "archived";

export interface MarketingPost {
  id: string;
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  imageAssets?: string[];
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
  imageAssets: string[];
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
  commands: Record<string, string>;
}

export interface GoLiveCheckResult {
  ok: boolean;
  generatedAt: string;
  requiredFailures: string[];
  missingExternalEvidence: string[];
  nextSteps: string[];
  checks: Array<{
    name: string;
    ok: boolean;
    severity: "required" | "warning";
    detail: string;
  }>;
}

export interface DailyTaskStatus {
  ok: boolean;
  installed: boolean;
  taskName: string;
  state?: string;
  lastRunTime?: string;
  lastTaskResult?: string;
  nextRunTime?: string;
  detail?: string;
  checkedAt: string;
  command: string;
  rawOutput: string[];
}

export interface HandoffPackageResult {
  outDir: string;
  files: {
    status: string;
    readiness: string;
    goLive: string;
    firstPublishChecklist: string;
    performanceReport: string;
    calendar: string;
    batchDryRun: string;
    summary: string;
    latestExport?: string;
    imageAssets?: string[];
  };
}

export interface MarkdownExportResult {
  postId: string;
  outDir: string;
  filename: string;
  outputPath: string;
}

export interface BackupResult {
  ok: boolean;
  source: string;
  target?: string;
  outDir: string;
  created: boolean;
  detail: string;
  generatedAt: string;
}

export interface PerformanceReportExportResult {
  outDir: string;
  filename: string;
  outputPath: string;
  postCount: number;
  measuredPosts: number;
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

export interface CoverImageResult {
  postId: string;
  outputPath: string;
  attached: boolean;
  post?: MarketingPost;
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
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to update post");
  }
  return (await response.json()) as MarketingPost;
}

export async function getPublishPackage(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/publish-package`);
  if (!response.ok) throw new Error("Failed to load publish package");
  return (await response.json()) as XhsPublishPackage;
}

export async function exportMarkdownPackage(id: string, outDir = "exports") {
  const response = await fetch(`${apiBase}/posts/${id}/export-package`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outDir })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to export Markdown package");
  }
  return (await response.json()) as MarkdownExportResult;
}

export async function generateCoverImage(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/cover-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to generate cover image");
  }
  return (await response.json()) as CoverImageResult;
}

export async function getStatus() {
  const response = await fetch(`${apiBase}/status`);
  if (!response.ok) throw new Error("Failed to load status");
  return (await response.json()) as SystemStatus;
}

export async function getGoLiveStatus() {
  const response = await fetch(`${apiBase}/go-live`);
  if (!response.ok) throw new Error("Failed to load go-live status");
  return (await response.json()) as GoLiveCheckResult;
}

export async function getDailyTaskStatus() {
  const response = await fetch(`${apiBase}/schedule/status`);
  if (!response.ok) throw new Error("Failed to load schedule status");
  return (await response.json()) as DailyTaskStatus;
}

export async function generateHandoffPackage(outDir = ".tmp/handoff") {
  const response = await fetch(`${apiBase}/handoff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outDir })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to generate handoff package");
  }
  return (await response.json()) as HandoffPackageResult;
}

export async function backupRuntimeData(outDir = "backups") {
  const response = await fetch(`${apiBase}/backup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outDir })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to back up runtime data");
  }
  return (await response.json()) as BackupResult;
}

export async function exportPerformanceReport(outDir = "exports") {
  const response = await fetch(`${apiBase}/performance-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outDir })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to export performance report");
  }
  return (await response.json()) as PerformanceReportExportResult;
}

export async function getContentCalendar(days = 7) {
  const response = await fetch(`${apiBase}/posts/calendar/plan?days=${days}`);
  if (!response.ok) throw new Error("Failed to load content calendar");
  return (await response.json()) as CalendarItem[];
}
