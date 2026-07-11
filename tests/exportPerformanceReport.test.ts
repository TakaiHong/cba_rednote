import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-performance-export-"));
const originalDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { exportPerformanceReport } = await import("../server/src/analytics/exportPerformanceReport.js");
const { postStore } = await import("../server/src/storage/postStore.js");

after(async () => {
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
  await rm(tempRoot, { force: true, recursive: true });
});

describe("exportPerformanceReport", () => {
  it("writes the standalone performance report", async () => {
    await postStore.createManual({
      title: "performance export post",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "published",
      metrics: { views: 200, inquiries: 6 }
    });

    const result = await exportPerformanceReport(relative(process.cwd(), join(tempRoot, "exports")));
    const markdown = await readFile(result.outputPath, "utf8");

    assert.equal(result.filename, "performance-report.md");
    assert.equal(result.postCount, 1);
    assert.equal(result.measuredPosts, 1);
    assert.match(markdown, /Xiaohongshu Performance Report/);
    assert.match(markdown, /Total views: 200/);
  });
});
