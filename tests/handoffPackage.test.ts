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
    const readiness = JSON.parse(await readFile(join(result.outDir, "readiness-checks.json"), "utf8")) as Array<{
      name: string;
      ok: boolean;
    }>;
    const summary = await readFile(join(result.outDir, "handoff-summary.md"), "utf8");
    const runs = await runLogStore.list();

    assert.ok(files.includes("status.json"));
    assert.ok(files.includes("readiness-checks.json"));
    assert.ok(files.includes("content-calendar.md"));
    assert.ok(files.includes("batch-generation-dry-run.json"));
    assert.ok(files.includes("handoff-summary.md"));
    assert.ok(files.some((file) => file.endsWith(".md") && file.includes("交接测试草稿")));
    assert.ok(readiness.some((check) => check.name === "preflight evidence" && check.ok === false));
    assert.match(summary, /Readiness Checks/);
    assert.equal(runs[0].action, "handoff");
  });
});
