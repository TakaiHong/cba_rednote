import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { CreatePostInput, MarketingPost, TopicPlan, UpdatePostInput } from "../types.js";

const rootDir = process.cwd();
const dataFile = join(rootDir, "data/posts.json");

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
  return JSON.parse(raw) as MarketingPost[];
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
  localSignals: ["Singapore", "mini storage"]
};

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
      callToAction: input.callToAction,
      status: input.status ?? "draft",
      topic: manualTopic,
      review: { score: 80, notes: ["Manual draft"], approved: true },
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
      status,
      publishedAt: status === "published" ? existing.publishedAt ?? new Date().toISOString() : existing.publishedAt,
      updatedAt: new Date().toISOString()
    };
    await writePosts(posts);
    return posts[index];
  }
};
