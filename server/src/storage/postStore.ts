import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { CreatePostInput, MarketingPost, TopicPlan, UpdatePostInput } from "../types.js";

// The mini-storage workspace remains in data/posts.json. Keep CBA content isolated.
const dataDir = process.env.DATA_DIR ? join(process.cwd(), process.env.DATA_DIR) : join(process.cwd(), "data", "ntu-cba");
const dataFile = join(dataDir, "posts.json");

async function ensureDataFile() {
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readPosts(): Promise<MarketingPost[]> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  try {
    return (JSON.parse(raw) as MarketingPost[]).map(withDefaults);
  } catch {
    const corruptFile = `${dataFile}.corrupt-${Date.now()}`;
    await rename(dataFile, corruptFile);
    await writeFile(dataFile, "[]\n", "utf8");
    console.warn(`[postStore] moved corrupt data file to ${corruptFile}`);
    return [];
  }
}

async function writePosts(posts: MarketingPost[]) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

const manualTopic: TopicPlan = {
  style: "direct",
  targetSegment: "general",
  scene: "manual draft",
  angle: "operator edited",
  hook: "manual",
  localSignals: ["NTU", "NBS"]
};

const emptyMetrics = { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 };

function withDefaults(post: MarketingPost): MarketingPost {
  return {
    ...post,
    imageAssets: post.imageAssets ?? [],
    revisionNotes: post.revisionNotes ?? [],
    metrics: {
      ...emptyMetrics,
      ...(post.metrics ?? {})
    }
  };
}

export const postStore = {
  async list() {
    const posts = await readPosts();
    return posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string) {
    const posts = await readPosts();
    return posts.find((post) => post.id === id);
  },

  async latestDraft() {
    const posts = await this.list();
    return posts.find((post) => post.status === "approved" || post.status === "draft");
  },

  async createGenerated(post: MarketingPost) {
    const posts = await readPosts();
    posts.push(post);
    await writePosts(posts);
    return post;
  },

  async createManual(input: CreatePostInput) {
    const now = new Date().toISOString();
    const post: MarketingPost = {
      id: uuidv4(),
      title: input.title,
      body: input.body,
      tags: input.tags,
      imageIdeas: input.imageIdeas,
      imageAssets: input.imageAssets ?? [],
      revisionNotes: [],
      callToAction: input.callToAction,
      status: input.status ?? "draft",
      topic: manualTopic,
      review: { score: 80, notes: ["Manual draft"], approved: true },
      metrics: { ...emptyMetrics, ...input.metrics },
      estimatedCostCny: 0,
      generator: "local-template",
      createdAt: now,
      updatedAt: now
    };
    const posts = await readPosts();
    posts.push(post);
    await writePosts(posts);
    return post;
  },

  async update(id: string, input: UpdatePostInput) {
    const posts = await readPosts();
    const index = posts.findIndex((post) => post.id === id);
    if (index === -1) return undefined;

    const existing = posts[index];
    const status = input.status ?? existing.status;
    posts[index] = {
      ...existing,
      ...input,
      metrics: input.metrics ? { ...emptyMetrics, ...existing.metrics, ...input.metrics } : existing.metrics,
      status,
      publishedAt: status === "published" ? existing.publishedAt ?? new Date().toISOString() : existing.publishedAt,
      updatedAt: new Date().toISOString()
    };
    await writePosts(posts);
    return posts[index];
  }
};
