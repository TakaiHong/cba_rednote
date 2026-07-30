import { getFirebaseIdToken } from "./firebase.js";

export type PostStatus = "draft" | "approved" | "published" | "archived";

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  accessedAt: string;
  claims: string[];
}

export interface ResearchSignal {
  id: string;
  sourceUrl: string;
  sourceType: "xiaohongshu" | "reddit";
  theme: string;
  audience: string;
  insight: string;
  interactionCount?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedditTrendStatus {
  configured: boolean;
  retentionDays: number;
  communities: string[];
  scope: string;
}

export interface KnowledgeBase {
  officialSources: SourceReference[];
  researchSignals: ResearchSignal[];
  reddit: RedditTrendStatus;
  policy: {
    purpose: string;
    restrictions: string[];
  };
}

export interface FactCheck {
  status: "needs_review" | "verified" | "blocked";
  notes: string[];
  checkedAt?: string;
}

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
  revisionNotes?: string[];
  sourceReferences?: SourceReference[];
  factCheck?: FactCheck;
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

export interface PreflightEvidenceResult {
  ok: boolean;
  path: string;
  postId?: string;
  generatedAt?: string;
  ageMs?: number;
  stale: boolean;
  url?: string;
  missingGroups: string[];
  groups: Record<
    "title" | "body" | "upload" | "publishButton",
    {
      ok: boolean;
      selectors: Array<{
        selector: string;
        count: number;
        visible: boolean;
      }>;
    }
  >;
  diagnostics: {
    visibleButtons: Array<{
      tag: string;
      text: string;
      ariaLabel: string;
      role: string;
      className: string;
      visible: boolean;
    }>;
  };
  detail: string;
}

export interface PublishJobResult {
  jobId: string;
  status: "queued" | "running" | "clicked" | "failed";
  postId: string;
  detail: string;
  updatedAt: string;
  selector?: string;
  url?: string;
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

export interface DailyTaskOperationResult {
  ok: boolean;
  mode: "install" | "uninstall";
  command: string;
  stdout: string[];
  stderr: string[];
  status: DailyTaskStatus;
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

export interface ImageUploadResult {
  post: MarketingPost;
  outputPath: string;
}

export interface AssistedPublishResult {
  postId: string;
  command: string;
  pid?: number;
}

export interface PublishPreflightLaunchResult {
  postId: string;
  command: string;
  pid?: number;
  reportPath: string;
}

const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
const apiBase = configuredApiBase || (window.location.hostname === "127.0.0.1" && window.location.port === "5173" ? "http://127.0.0.1:8787/api" : "/api");
const nativeFetch = window.fetch.bind(window);

async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = await getFirebaseIdToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers });
}

const fetch = apiFetch;

export async function listPosts() {
  const response = await fetch(`${apiBase}/posts`);
  if (!response.ok) throw new Error("Failed to load posts");
  return (await response.json()) as MarketingPost[];
}

export async function getKnowledgeBase() {
  const response = await fetch(`${apiBase}/knowledge-base`);
  if (!response.ok) throw new Error("Failed to load knowledge base");
  return (await response.json()) as KnowledgeBase;
}

export async function addResearchSignal(input: Pick<ResearchSignal, "sourceUrl" | "theme" | "audience" | "insight">) {
  const response = await fetch(`${apiBase}/knowledge-base/research-signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to save public-reference insight");
  }
  return (await response.json()) as ResearchSignal;
}

export async function deleteResearchSignal(id: string) {
  const response = await fetch(`${apiBase}/knowledge-base/research-signals/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to remove public-reference insight");
}

export async function syncRedditSignals() {
  const response = await fetch(`${apiBase}/knowledge-base/reddit/sync`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to sync Reddit trend signals");
  }
  return (await response.json()) as { configured: boolean; scanned: number; added: number; skipped: number; retentionDays: number; communities: string[] };
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

export async function regeneratePost(id: string, feedback: string) {
  const response = await fetch(`${apiBase}/posts/${id}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback })
  });
  if (!response.ok) throw new Error(await response.text());
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

export function getImageAssetUrl(path: string) {
  if (path.startsWith("data:image/")) return path;
  return `${apiBase}/assets/image?path=${encodeURIComponent(path)}`;
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

export async function uploadImageAsset(id: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const response = await fetch(`${apiBase}/posts/${id}/image-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentBase64: btoa(binary) })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to upload image");
  }
  return (await response.json()) as ImageUploadResult;
}

export async function startAssistedPublish(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/assisted-publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to start assisted publish");
  }
  return (await response.json()) as AssistedPublishResult;
}

export async function startFinalPublish(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/final-publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "publish" })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to start final publish");
  }
  return (await response.json()) as AssistedPublishResult & { jobId: string; reportPath: string };
}

export async function getPublishJob(jobId: string) {
  const response = await fetch(`${apiBase}/posts/publish-jobs/${jobId}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to load publish job");
  }
  return (await response.json()) as PublishJobResult;
}

export async function startPublishPreflight(id: string) {
  const response = await fetch(`${apiBase}/posts/${id}/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to start publish preflight");
  }
  return (await response.json()) as PublishPreflightLaunchResult;
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

export async function getPreflightEvidence() {
  const response = await fetch(`${apiBase}/preflight-evidence`);
  if (!response.ok) throw new Error("Failed to load preflight evidence");
  return (await response.json()) as PreflightEvidenceResult;
}

export async function getDailyTaskStatus() {
  const response = await fetch(`${apiBase}/schedule/status`);
  if (!response.ok) throw new Error("Failed to load schedule status");
  return (await response.json()) as DailyTaskStatus;
}

export async function installDailyTask() {
  const response = await fetch(`${apiBase}/schedule/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to install daily task");
  }
  return (await response.json()) as DailyTaskOperationResult;
}

export async function uninstallDailyTask() {
  const response = await fetch(`${apiBase}/schedule/uninstall`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(payload?.error ?? "Failed to uninstall daily task");
  }
  return (await response.json()) as DailyTaskOperationResult;
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
