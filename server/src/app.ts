import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";
import { exportPerformanceReport, type PerformanceReportExportResult } from "./analytics/exportPerformanceReport.js";
import { backupRuntimeData, type BackupResult } from "./backup.js";
import { readPreflightEvidence } from "./publishing/preflightEvidence.js";
import postsRouter, { createPostsRouter, type PostsRouterDependencies } from "./routes/posts.js";
import { getDailyTaskStatus, type DailyTaskStatus } from "./scheduleStatus.js";
import { getSystemStatus } from "./status.js";
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
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const scheduleStatusReader = dependencies.scheduleStatusReader ?? getDailyTaskStatus;
  const scheduleInstaller = dependencies.scheduleInstaller ?? ((mode) => runDailyTaskInstaller(mode, scheduleStatusReader));

  app.use(cors());
  app.use(express.json({ limit: "8mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "ntu-cba-xhs-platform" });
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

  return app;
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
