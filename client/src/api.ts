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
  estimatedCostCny: number;
  generator: string;
  createdAt: string;
  updatedAt: string;
  publishedUrl?: string;
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

export async function updatePost(id: string, patch: Partial<MarketingPost>) {
  const response = await fetch(`${apiBase}/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error("Failed to update post");
  return (await response.json()) as MarketingPost;
}
