import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { renderPerformanceReport } from "./performanceReport.js";
import { postStore } from "../storage/postStore.js";

export interface PerformanceReportExportResult {
  outDir: string;
  filename: string;
  outputPath: string;
  postCount: number;
  measuredPosts: number;
}

export async function exportPerformanceReport(outDir = "exports") {
  const posts = await postStore.list();
  const resolvedOutDir = resolve(outDir);
  const filename = "performance-report.md";
  const outputPath = join(resolvedOutDir, filename);

  await mkdir(resolvedOutDir, { recursive: true });
  await writeFile(outputPath, renderPerformanceReport(posts), "utf8");

  return {
    outDir: resolvedOutDir,
    filename,
    outputPath,
    postCount: posts.length,
    measuredPosts: posts.filter((post) => post.metrics.views > 0).length
  } satisfies PerformanceReportExportResult;
}
