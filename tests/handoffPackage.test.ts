import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-handoff-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));
process.env.XHS_PREFLIGHT_REPORT = relative(process.cwd(), join(tempRoot, "missing-preflight.json"));

const { generateHandoffPackage } = await import("../scripts/handoff-package.js");
const { postStore } = await import("../server/src/storage/postStore.js");
const { runLogStore } = await import("../server/src/storage/runLogStore.js");

after(async () => {
  delete process.env.XHS_PREFLIGHT_REPORT;
  await rm(tempRoot, { force: true, recursive: true });
});

describe("generateHandoffPackage", () => {
  it("exports the operational evidence bundle", async () => {
    await postStore.createManual({
      title: "交接测试草稿",
      body: "这是一条用于测试 handoff 的小红书正文。",
      tags: ["新加坡生活", "迷你仓"],
      imageIdeas: ["纸箱和行李箱"],
      callToAction: "私信物品清单。",
      status: "approved"
    });

    const result = await generateHandoffPackage({
      outDir: relative(process.cwd(), join(tempRoot, "handoff"))
    });
    const files = await readdir(result.outDir);
    const imageAssetFiles = await readdir(join(result.outDir, "image-assets"));
    const readiness = JSON.parse(await readFile(join(result.outDir, "readiness-checks.json"), "utf8")) as Array<{
      name: string;
      ok: boolean;
    }>;
    const goLive = JSON.parse(await readFile(join(result.outDir, "go-live-check.json"), "utf8")) as {
      ok: boolean;
      missingExternalEvidence: string[];
      nextSteps: string[];
    };
    const summary = await readFile(join(result.outDir, "handoff-summary.md"), "utf8");
    const firstPublishChecklist = await readFile(join(result.outDir, "first-publish-checklist.md"), "utf8");
    const performanceReport = await readFile(join(result.outDir, "performance-report.md"), "utf8");
    const imageBrief = await readFile(join(result.outDir, "image-assets", "image-asset-brief.md"), "utf8");
    const runs = await runLogStore.list();
    const handoffRun = runs.find((run) => run.action === "handoff");

    assert.ok(files.includes("status.json"));
    assert.ok(files.includes("readiness-checks.json"));
    assert.ok(files.includes("go-live-check.json"));
    assert.ok(files.includes("content-calendar.md"));
    assert.ok(files.includes("batch-generation-dry-run.json"));
    assert.ok(files.includes("handoff-summary.md"));
    assert.ok(files.includes("first-publish-checklist.md"));
    assert.ok(files.includes("performance-report.md"));
    assert.ok(files.includes("image-assets"));
    assert.ok(imageAssetFiles.includes("image-asset-brief.md"));
    assert.ok(imageAssetFiles.includes("image-prompt.txt"));
    assert.ok(imageAssetFiles.includes("image-asset-brief.json"));
    assert.ok(files.some((file) => file.endsWith(".md") && file.includes("交接测试草稿")));
    assert.ok(readiness.some((check) => check.name === "preflight evidence" && check.ok === false));
    assert.equal(goLive.ok, false);
    assert.ok(goLive.missingExternalEvidence.includes("preflight evidence"));
    assert.ok(goLive.nextSteps.some((step) => step.includes("publish:preflight")));
    assert.match(summary, /Readiness Checks/);
    assert.match(summary, /Go-Live Check/);
    assert.match(summary, /Next Steps/);
    assert.match(summary, /First publish checklist/);
    assert.match(summary, /Performance report/);
    assert.match(summary, /Image asset brief/);
    assert.match(firstPublishChecklist, /First Xiaohongshu Publish Checklist/);
    assert.match(firstPublishChecklist, /publish:preflight/);
    assert.match(firstPublishChecklist, /--mark-published/);
    assert.match(performanceReport, /Xiaohongshu Performance Report/);
    assert.match(performanceReport, /Metric Backfill Checklist/);
    assert.match(imageBrief, /AI 出图 Prompt/);
    assert.ok(handoffRun);
    assert.equal(handoffRun.metadata?.hasImageAssetBrief, true);
    assert.equal(handoffRun.metadata?.goLiveReady, false);
  });
});
