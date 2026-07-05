import { Router } from "express";
import { z } from "zod";
import { generateMarketingPost } from "../generation/generator.js";
import { createXhsPublishPackage } from "../publishing/xhsPackage.js";
import { postStore } from "../storage/postStore.js";

const router = Router();

const postInputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).default([]),
  imageIdeas: z.array(z.string()).default([]),
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

router.get("/", async (_req, res) => {
  res.json(await postStore.list());
});

router.get("/latest", async (_req, res) => {
  const post = await postStore.latestDraft();
  if (!post) return res.status(404).json({ error: "No draft found" });
  res.json(post);
});

router.get("/:id/publish-package", async (req, res) => {
  const post = await postStore.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(createXhsPublishPackage(post));
});

router.post("/", async (req, res) => {
  const input = postInputSchema.parse(req.body);
  res.status(201).json(await postStore.createManual(input));
});

router.post("/generate", async (req, res) => {
  const existingPosts = await postStore.list();
  const offset = Number(req.body?.offset ?? existingPosts.length);
  const post = await generateMarketingPost(offset);
  res.status(201).json(await postStore.createGenerated(post));
});

router.patch("/:id", async (req, res) => {
  const input = updateSchema.parse(req.body);
  const post = await postStore.update(req.params.id, input);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

export default router;
