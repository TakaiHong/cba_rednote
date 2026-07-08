import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-status-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { postStore } = await import("../server/src/storage/postStore.js");
const { runLogStore } = await import("../server/src/storage/runLogStore.js");
const { getSystemStatus } = await import("../server/src/status.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("getSystemStatus", () => {
  it("summarizes counts, config, and operational commands", async () => {
    await postStore.createManual({
      title: "status draft",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });
    await runLogStore.append({ action: "status-test", status: "ok", message: "status test run" });

    const status = await getSystemStatus();

    assert.equal(status.ok, true);
    assert.equal(status.counts.total, 1);
    assert.equal(status.counts.approved, 1);
    assert.equal(status.config.maxCostCnyPerPost <= 0.5, true);
    assert.equal(typeof status.config.modelProvider, "string");
    assert.equal(status.cost.totalEstimatedCostCny, 0);
    assert.equal(status.cost.withinPerPostBudget, true);
    assert.equal(status.recentRuns[0].action, "status-test");
    assert.equal(status.commands.calendar, "npm.cmd run calendar -- --days 7");
    assert.equal(status.commands.imageBrief, "npm.cmd run image:brief -- --post latest --out .tmp/image-assets");
    assert.equal(status.commands.imageCover, "npm.cmd run image:cover -- --post latest --attach");
    assert.equal(status.commands.handoff, "npm.cmd run handoff -- --out .tmp/handoff");
    assert.equal(status.commands.goLiveCheck, "npm.cmd run go-live:check");
    assert.equal(status.commands.backup, "npm.cmd run backup");
    assert.equal(status.commands.verify, "npm.cmd run verify");
    assert.ok(status.strategy.recommendation);
  });
});
