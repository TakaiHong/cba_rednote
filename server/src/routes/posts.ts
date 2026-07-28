import { Router } from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { z } from "zod";
import { generatePostBatch } from "../generation/batch.js";
import { planContentCalendar } from "../generation/contentCalendar.js";
import { generateUniqueMarketingPost, regenerateMarketingPost } from "../generation/generator.js";
import { exportXhsMarkdownPackage } from "../publishing/exportPackage.js";
import { readPreflightEvidence } from "../publishing/preflightEvidence.js";
import { resolvePublishedUrlEvidence } from "../publishing/publishedUrl.js";
import { createXhsPublishPackage } from "../publishing/xhsPackage.js";
import { postStore } from "../storage/postStore.js";
import { runLogStore } from "../storage/runLogStore.js";
import { generateCoverImage } from "../../../scripts/generate-cover-image.js";
import type { MarketingPost } from "../types.js";

type CoverImageGenerator = typeof generateCoverImage;
type PostRegenerator = (post: MarketingPost, feedback: string) => Promise<MarketingPost>;
type PublishLauncher = (postId: string) => Promise<{ command: string; pid?: number }>;
type PreflightLauncher = (postId: string) => Promise<{ command: string; pid?: number; reportPath: string }>;
type FinalPublishLauncher = (
  postId: string
) => Promise<{ command: string; pid?: number; jobId: string; reportPath: string }>;

export interface PostsRouterDependencies {
  coverImageGenerator?: CoverImageGenerator;
  postRegenerator?: PostRegenerator;
  publishLauncher?: PublishLauncher;
  preflightLauncher?: PreflightLauncher;
  finalPublishLauncher?: FinalPublishLauncher;
}

const postInputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).default([]),
  imageIdeas: z.array(z.string()).default([]),
  imageAssets: z.array(z.string().min(1)).default([]),
  revisionNotes: z.array(z.string().min(1).max(500)).default([]),
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

const regenerateSchema = z.object({
  feedback: z.string().trim().min(1).max(500)
});

const imageUploadSchema = z.object({
  filename: z.string().min(1).max(120),
  contentBase64: z.string().min(1).max(8_000_000)
});

const supportedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function createPostsRouter(dependencies: PostsRouterDependencies = {}) {
  const router = Router();
  const coverImageGenerator = dependencies.coverImageGenerator ?? generateCoverImage;
  const postRegenerator = dependencies.postRegenerator ?? regenerateMarketingPost;
  const publishLauncher = dependencies.publishLauncher ?? launchAssistedPublish;
  const preflightLauncher = dependencies.preflightLauncher ?? launchPublishPreflight;
  const finalPublishLauncher = dependencies.finalPublishLauncher ?? launchFinalPublish;

function spawnNpmCommand(args: string[], env = process.env) {
  const executable = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const child = spawn(executable, executableArgs, {
    cwd: process.cwd(),
    detached: true,
    env,
    shell: false,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  return child;
}

async function launchAssistedPublish(postId: string) {
  const command = `npm.cmd run publish -- --post ${postId}`;
  const child = spawnNpmCommand(["run", "publish", "--", "--post", postId]);
  return { command, pid: child.pid };
}

async function launchPublishPreflight(postId: string) {
  const reportPath = ".tmp/xhs-preflight-report.json";
  const args = ["run", "publish", "--", "--post", postId, "--preflight", "--no-pause", "--preflight-report", reportPath];
  const command = `npm.cmd ${args.join(" ")}`;
  const child = spawnNpmCommand(args);
  return { command, pid: child.pid, reportPath };
}

async function launchFinalPublish(postId: string) {
  const jobId = randomUUID();
  const jobDir = process.env.PUBLISH_JOB_DIR ?? ".tmp/publish-jobs";
  const reportPath = join(jobDir, `${jobId}.json`);
  await mkdir(jobDir, { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify({ status: "queued", postId, detail: "Publish task queued.", updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8"
  );
  const args = [
    "run",
    "publish",
    "--",
    "--post",
    postId,
    "--click-publish",
    "--no-pause",
    "--result-report",
    reportPath
  ];
  const command = `npm.cmd ${args.join(" ")}`;
  const child = spawnNpmCommand(args, { ...process.env, XHS_ALLOW_FINAL_PUBLISH: "true" });
  return { command, pid: child.pid, jobId, reportPath };
}

router.get("/publish-jobs/:jobId", async (req, res) => {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.jobId)) {
    return res.status(400).json({ error: "Invalid publish job id." });
  }
  try {
    const jobDir = process.env.PUBLISH_JOB_DIR ?? ".tmp/publish-jobs";
    const report = JSON.parse(await readFile(join(jobDir, `${req.params.jobId}.json`), "utf8"));
    res.json({ jobId: req.params.jobId, ...report });
  } catch {
    res.status(404).json({ error: "Publish job not found." });
  }
});

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

router.post("/:id/regenerate", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const input = regenerateSchema.parse(req.body ?? {});
  try {
    const regenerated = await postRegenerator(post, input.feedback);
    const updated = await postStore.update(post.id, regenerated);
    await runLogStore.append({
      action: "api-regenerate-post",
      status: "ok",
      message: `Regenerated post ${post.id} from review feedback.`,
      metadata: { postId: post.id, generator: regenerated.generator }
    });
    res.status(201).json(updated);
  } catch (error) {
    await runLogStore.append({
      action: "api-regenerate-post",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { postId: post.id }
    });
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/:id/image-upload", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const input = imageUploadSchema.parse(req.body ?? {});
  const filename = basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = extname(filename).toLowerCase();
  if (!supportedImageExtensions.has(extension)) {
    return res.status(400).json({ error: "Only PNG, JPG, JPEG, and WebP images are supported." });
  }

  const imageBuffer = Buffer.from(input.contentBase64, "base64");
  if (!imageBuffer.length || imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be between 1 byte and 5 MB." });
  }

  const outputDir = join(".tmp", "uploaded-images", post.id);
  const outputPath = join(outputDir, `${Date.now()}-${filename}`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, imageBuffer);
  const updated = await postStore.update(post.id, { imageAssets: [...(post.imageAssets ?? []), outputPath] });
  await runLogStore.append({
    action: "api-upload-image",
    status: "ok",
    message: `Uploaded image for post ${post.id}`,
    metadata: { postId: post.id, outputPath }
  });
  res.status(201).json({ post: updated, outputPath });
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

router.post("/:id/preflight", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  try {
    const result = await preflightLauncher(post.id);
    await runLogStore.append({
      action: "api-publish-preflight",
      status: "ok",
      message: `Started Xiaohongshu preflight for post ${post.id}`,
      metadata: {
        postId: post.id,
        command: result.command,
        pid: result.pid,
        reportPath: result.reportPath
      }
    });
    res.status(202).json({ postId: post.id, ...result });
  } catch (error) {
    await runLogStore.append({
      action: "api-publish-preflight",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { postId: post.id }
    });
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/:id/final-publish", async (req, res) => {
  return res.status(410).json({
    error: "Final publish is manual-only. Copy the prepared text and publish inside Xiaohongshu."
  });
  /*
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (req.body?.confirmation !== "publish") {
    return res.status(400).json({ error: "Final publish requires explicit confirmation." });
  }
  if (post.status !== "approved") {
    return res.status(409).json({ error: "Only approved posts can be published." });
  }
  if (!post.imageAssets?.length) {
    return res.status(409).json({ error: "Generate or attach at least one image before publishing." });
  }

  const preflight = await readPreflightEvidence();
  if (!preflight.ok) {
    return res.status(409).json({ error: `Account preflight is not ready: ${preflight.detail}` });
  }

  try {
    const result = await finalPublishLauncher(post.id);
    await runLogStore.append({
      action: "api-final-publish",
      status: "ok",
      message: `Started confirmed final publish for post ${post.id}`,
      metadata: { postId: post.id, command: result.command, pid: result.pid }
    });
    res.status(202).json({ postId: post.id, ...result });
  } catch (error) {
    await runLogStore.append({
      action: "api-final-publish",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { postId: post.id }
    });
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
  */
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
