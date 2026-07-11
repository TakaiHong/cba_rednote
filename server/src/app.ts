import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { exportPerformanceReport, type PerformanceReportExportResult } from "./analytics/exportPerformanceReport.js";
import { backupRuntimeData, type BackupResult } from "./backup.js";
import { readPreflightEvidence } from "./publishing/preflightEvidence.js";
import postsRouter, { createPostsRouter, type PostsRouterDependencies } from "./routes/posts.js";
import { getDailyTaskStatus, type DailyTaskStatus } from "./scheduleStatus.js";
import { getSystemStatus } from "./status.js";
import { generateHandoffPackage } from "../../scripts/handoff-package.js";
import { runGoLiveCheck } from "../../scripts/go-live-check.js";

export interface AppDependencies {
  posts?: PostsRouterDependencies;
  scheduleStatusReader?: () => Promise<DailyTaskStatus>;
  handoffPackageGenerator?: typeof generateHandoffPackage;
  backupRunner?: typeof backupRuntimeData;
  performanceReportExporter?: typeof exportPerformanceReport;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "xhs-mini-storage-platform" });
  });

  app.get("/api/status", async (_req, res) => {
    res.json(await getSystemStatus());
  });

  app.get("/api/go-live", async (_req, res) => {
    res.json(await runGoLiveCheck());
  });

  app.get("/api/preflight-evidence", async (_req, res) => {
    res.json(await readPreflightEvidence());
  });

  app.get("/api/assets/image", async (req, res) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path : "";
    if (!rawPath.trim()) return res.status(400).json({ error: "path is required" });

    const projectRoot = resolve(process.cwd());
    const resolvedPath = resolve(projectRoot, rawPath);
    const relativePath = relative(projectRoot, resolvedPath);
    if (relativePath.startsWith("..") || relativePath === "" || resolve(relativePath) === relativePath || !existsSync(resolvedPath)) {
      return res.status(404).json({ error: "Image not found" });
    }

    const lowerPath = resolvedPath.toLowerCase();
    if (lowerPath.endsWith(".png")) res.type("image/png");
    if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) res.type("image/jpeg");
    if (lowerPath.endsWith(".webp")) res.type("image/webp");
    res.send(await readFile(resolvedPath));
  });

  app.get("/api/schedule/status", async (_req, res) => {
    const reader = dependencies.scheduleStatusReader ?? getDailyTaskStatus;
    res.json(await reader());
  });

  app.post("/api/handoff", async (req, res) => {
    const generator = dependencies.handoffPackageGenerator ?? generateHandoffPackage;
    const outDir = typeof req.body?.outDir === "string" && req.body.outDir.trim() ? req.body.outDir.trim() : ".tmp/handoff";
    try {
      res.status(201).json(await generator({ outDir }));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/backup", async (req, res) => {
    const runner = dependencies.backupRunner ?? backupRuntimeData;
    const outDir = typeof req.body?.outDir === "string" && req.body.outDir.trim() ? req.body.outDir.trim() : "backups";
    try {
      const result: BackupResult = await runner(outDir);
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/performance-report", async (req, res) => {
    const exporter = dependencies.performanceReportExporter ?? exportPerformanceReport;
    const outDir = typeof req.body?.outDir === "string" && req.body.outDir.trim() ? req.body.outDir.trim() : "exports";
    try {
      const result: PerformanceReportExportResult = await exporter(outDir);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.use("/api/posts", dependencies.posts ? createPostsRouter(dependencies.posts) : postsRouter);

  return app;
}
