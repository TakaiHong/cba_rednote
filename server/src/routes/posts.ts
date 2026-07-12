import { Router } from "express";
import { spawn } from "node:child_process";
import { z } from "zod";
import { generatePostBatch } from "../generation/batch.js";
import { planContentCalendar } from "../generation/contentCalendar.js";
import { generateUniqueMarketingPost } from "../generation/generator.js";
import { exportXhsMarkdownPackage } from "../publishing/exportPackage.js";
import { resolvePublishedUrlEvidence } from "../publishing/publishedUrl.js";
import { createXhsPublishPackage } from "../publishing/xhsPackage.js";
import { postStore } from "../storage/postStore.js";
import { runLogStore } from "../storage/runLogStore.js";
import { generateCoverImage } from "../../../scripts/generate-cover-image.js";

type CoverImageGenerator = typeof generateCoverImage;
type PublishLauncher = (postId: string) => Promise<{ command: string; pid?: number }>;

export interface PostsRouterDependencies {
  coverImageGenerator?: CoverImageGenerator;
  publishLauncher?: PublishLauncher;
}

const postInputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).default([]),
  imageIdeas: z.array(z.string()).default([]),
  imageAssets: z.array(z.string().min(1)).default([]),
  callToAction: z.string().default(""),
  status: z.enum(["draft", "approved", "published", "archived"]).optional(),
  metrics: z
    .object({
      views: z.number().int().nonnegative().optional(),
      likes: z.number().int().nonnegative().optional(),
      saves: z.number().int().nonnegative().optional(),
      comments: z.number().int().nonnegative().optional(),
      follows: z.number().int().nonnegative().optional(),
      inquiries: z.number().int().nonnegative().optional()
    })
    .optional()
});

const updateSchema = postInputSchema.partial().extend({
  publishedUrl: z.string().optional()
});

const batchGenerateSchema = z.object({
  count: z.number().int().min(1).max(14).default(7),
  maxModelPosts: z.number().int().min(0).max(14).default(1)
});

export function createPostsRouter(dependencies: PostsRouterDependencies = {}) {
  const router = Router();
  const coverImageGenerator = dependencies.coverImageGenerator ?? generateCoverImage;
  const publishLauncher = dependencies.publishLauncher ?? launchAssistedPublish;

async function launchAssistedPublish(postId: string) {
  const command = `npm.cmd run publish -- --post ${postId}`;
  const child = spawn("npm.cmd", ["run", "publish", "--", "--post", postId], {
    cwd: process.cwd(),
    detached: true,
    shell: false,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  return { command, pid: child.pid };
}

router.get("/", async (_req, res) => {
  res.json(await postStore.list());
});

router.get("/latest", async (_req, res) => {
  const post = await postStore.latestDraft();
  if (!post) return res.status(404).json({ error: "No draft found" });
  res.json(post);
});

router.get("/calendar/plan", async (req, res) => {
  const days = Number(req.query.days ?? 7);
  res.json(planContentCalendar(days));
});

router.get("/:id/publish-package", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(createXhsPublishPackage(post));
});

router.post("/:id/export-package", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  try {
    const result = await exportXhsMarkdownPackage(post, req.body?.outDir ?? "exports");
    await runLogStore.append({
      action: "api-export-package",
      status: "ok",
      message: `Exported Markdown package for post ${post.id}`,
      metadata: {
        postId: post.id,
        outputPath: result.outputPath
      }
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/:id/cover-image", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  try {
    const result = await coverImageGenerator({
      post: post.id,
      outDir: req.body?.outDir ?? ".tmp/generated-covers",
      attach: true
    });
    const updated = await postStore.get(post.id);
    res.status(201).json({ ...result, post: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/:id/assisted-publish", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  try {
    const result = await publishLauncher(post.id);
    await runLogStore.append({
      action: "api-assisted-publish",
      status: "ok",
      message: `Started assisted publish for post ${post.id}`,
      metadata: {
        postId: post.id,
        command: result.command,
        pid: result.pid
      }
    });
    res.status(202).json({ postId: post.id, ...result });
  } catch (error) {
    await runLogStore.append({
      action: "api-assisted-publish",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { postId: post.id }
    });
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/", async (req, res) => {
  const input = postInputSchema.parse(req.body);
  const post = await postStore.createManual(input);
  await runLogStore.append({
    action: "api-create-manual",
    status: "ok",
    message: `Created manual post ${post.id}`,
    metadata: { postId: post.id, status: post.status }
  });
  res.status(201).json(post);
});

router.post("/generate", async (req, res) => {
  const existingPosts = await postStore.list();
  const offset = Number(req.body?.offset ?? existingPosts.length);
  const post = await generateUniqueMarketingPost(existingPosts, offset);
  const saved = await postStore.createGenerated(post);
  await runLogStore.append({
    action: "api-generate",
    status: "ok",
    message: `Generated post ${saved.id} from dashboard/API`,
    metadata: {
      postId: saved.id,
      generator: saved.generator,
      estimatedCostCny: saved.estimatedCostCny
    }
  });
  res.status(201).json(saved);
});

router.post("/generate-batch", async (req, res) => {
  const input = batchGenerateSchema.parse(req.body ?? {});
  const existingPosts = await postStore.list();
  const result = await generatePostBatch(existingPosts, input);
  const saved = [];

  for (const post of result.posts) {
    saved.push(await postStore.createGenerated(post));
  }

  await runLogStore.append({
    action: "api-generate-batch",
    status: "ok",
    message: `Generated ${saved.length} posts from dashboard/API`,
    metadata: {
      count: saved.length,
      maxModelPosts: result.plan.maxModelPosts,
      estimatedMaxCostCny: result.plan.estimatedMaxCostCny
    }
  });

  res.status(201).json({ plan: result.plan, posts: saved });
});

router.patch("/:id", async (req, res) => {
  const input = updateSchema.parse(req.body);
  const existing = await postStore.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const publishedUrlEvidence = resolvePublishedUrlEvidence({
    status: input.status,
    publishedUrl: input.publishedUrl,
    existingPublishedUrl: existing.publishedUrl
  });
  if (!publishedUrlEvidence.ok) {
    return res.status(400).json({ error: publishedUrlEvidence.error });
  }

  const updateInput = input.publishedUrl === undefined ? input : { ...input, publishedUrl: publishedUrlEvidence.publishedUrl };
  const post = await postStore.update(req.params.id, updateInput);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (input.status === "published" || input.publishedUrl) {
    await runLogStore.append({
      action: "api-update-publish",
      status: "ok",
      message: `Updated publish state for post ${post.id}`,
      metadata: {
        postId: post.id,
        status: post.status,
        hasPublishedUrl: Boolean(post.publishedUrl)
      }
    });
  }
  res.json(post);
});

  return router;
}

export default createPostsRouter();
