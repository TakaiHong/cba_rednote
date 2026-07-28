import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { exportPerformanceReport, type PerformanceReportExportResult } from "./analytics/exportPerformanceReport.js";
import { backupRuntimeData, type BackupResult } from "./backup.js";
import { readPreflightEvidence } from "./publishing/preflightEvidence.js";
import postsRouter, { createPostsRouter, type PostsRouterDependencies } from "./routes/posts.js";
import { getDailyTaskStatus, type DailyTaskStatus } from "./scheduleStatus.js";
import { getSystemStatus } from "./status.js";
import { config } from "./config.js";
import { readImageAsset } from "./storage/assetStore.js";
import { runScheduledGeneration } from "./scheduler.js";
import { generateHandoffPackage } from "../../scripts/handoff-package.js";
import { runGoLiveCheck } from "../../scripts/go-live-check.js";

const execFileAsync = promisify(execFile);

export interface DailyTaskOperationResult {
  ok: boolean;
  mode: "install" | "uninstall";
  command: string;
  stdout: string[];
  stderr: string[];
  status: DailyTaskStatus;
}

type DailyTaskInstaller = (mode: "install" | "uninstall") => Promise<DailyTaskOperationResult>;

export interface AppDependencies {
  posts?: PostsRouterDependencies;
  scheduleStatusReader?: () => Promise<DailyTaskStatus>;
  scheduleInstaller?: DailyTaskInstaller;
  handoffPackageGenerator?: typeof generateHandoffPackage;
  backupRunner?: typeof backupRuntimeData;
  performanceReportExporter?: typeof exportPerformanceReport;
  dashboardAuth?: DashboardAuth;
}

export interface DashboardAuth {
  username: string;
  password: string;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const scheduleStatusReader = dependencies.scheduleStatusReader ?? getDailyTaskStatus;
  const scheduleInstaller = dependencies.scheduleInstaller ?? ((mode) => runDailyTaskInstaller(mode, scheduleStatusReader));
  const dashboardAuth = dependencies.dashboardAuth ?? {
    username: config.dashboardUsername,
    password: config.dashboardPassword
  };

  app.use(cors());
  app.use(express.json({ limit: "8mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "ntu-cba-xhs-platform" });
  });

  app.post("/api/jobs/daily-generate", async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (!config.cloudSchedulerToken || token !== config.cloudSchedulerToken) {
      return res.status(401).json({ error: "Unauthorized scheduler request" });
    }

    try {
      const post = await runScheduledGeneration();
      return res.status(201).json({ postId: post.id, status: "generated" });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.use(createDashboardAuthMiddleware(dashboardAuth));

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
    try {
      const asset = await readImageAsset(rawPath);
      res.type(asset.contentType).send(asset.bytes);
    } catch {
      res.status(404).json({ error: "Image not found" });
    }
  });

  app.get("/api/schedule/status", async (_req, res) => {
    res.json(await scheduleStatusReader());
  });

  app.post("/api/schedule/install", async (_req, res) => {
    try {
      res.status(202).json(await scheduleInstaller("install"));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/schedule/uninstall", async (_req, res) => {
    try {
      res.status(202).json(await scheduleInstaller("uninstall"));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
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

  const staticDir = resolve(process.cwd(), "dist");
  const indexFile = join(staticDir, "index.html");
  if (existsSync(indexFile)) {
    app.use(express.static(staticDir));
    app.get("/{*path}", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(indexFile);
    });
  }

  return app;
}

function createDashboardAuthMiddleware(auth: DashboardAuth) {
  if (!auth.password) {
    return (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();
  }

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const header = req.headers.authorization;
    const encoded = header?.startsWith("Basic ") ? header.slice(6) : "";
    const expected = Buffer.from(`${auth.username}:${auth.password}`, "utf8");
    const actual = Buffer.from(encoded, "base64");

    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return next();
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="NTU CBA Content Desk", charset="UTF-8"');
    return res.status(401).json({ error: "Authentication required" });
  };
}

async function runDailyTaskInstaller(
  mode: "install" | "uninstall",
  scheduleStatusReader: () => Promise<DailyTaskStatus>
): Promise<DailyTaskOperationResult> {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/install-daily-task.ps1"];
  if (mode === "uninstall") args.push("-Uninstall");

  const command = `powershell ${args.join(" ")}`;
  const result = await execFileAsync("powershell", args, {
    cwd: process.cwd(),
    windowsHide: true
  });
  const status = await scheduleStatusReader();

  return {
    ok: true,
    mode,
    command,
    stdout: result.stdout.split(/\r?\n/).filter(Boolean),
    stderr: result.stderr.split(/\r?\n/).filter(Boolean),
    status
  };
}
