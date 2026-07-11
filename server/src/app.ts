import cors from "cors";
import express from "express";
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
