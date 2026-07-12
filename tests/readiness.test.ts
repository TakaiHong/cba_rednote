import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-readiness-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));
process.env.XHS_PREFLIGHT_REPORT = relative(process.cwd(), join(tempRoot, "preflight.json"));

const { postStore } = await import("../server/src/storage/postStore.js");
const { buildReadinessChecks, readPreflightEvidence, readPublishedUrlEvidence } = await import("../scripts/readiness.js");

after(async () => {
  delete process.env.XHS_PREFLIGHT_REPORT;
  await rm(tempRoot, { force: true, recursive: true });
});

describe("readiness evidence", () => {
  it("recognizes a usable Xiaohongshu preflight report", async () => {
    await mkdir(tempRoot, { recursive: true });
    await writeFile(
      join(tempRoot, "preflight.json"),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        selectors: {
          title: [{ selector: "title", count: 1, visible: true }],
          body: [{ selector: "body", count: 1, visible: true }],
          upload: [{ selector: "upload", count: 1, visible: true }],
          publishButton: [{ selector: "button", count: 1, visible: true }]
        }
      }),
      "utf8"
    );

    const evidence = await readPreflightEvidence();

    assert.equal(evidence.ok, true);
    assert.match(evidence.detail, /visible selector hits/);
  });

  it("recognizes a recorded published Xiaohongshu URL", async () => {
    assert.equal((await readPublishedUrlEvidence()).ok, false);

    const post = await postStore.createManual({
      title: "published note",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });
    await postStore.update(post.id, {
      status: "published",
      publishedUrl: "https://www.xiaohongshu.com/explore/example"
    });

    const evidence = await readPublishedUrlEvidence();

    assert.equal(evidence.ok, true);
    assert.match(evidence.detail, /published post/);
  });

  it("requires both image asset handoff and cover generation commands", async () => {
    const checks = await buildReadinessChecks();
    const imageCheck = checks.find((check) => check.name === "image asset commands");

    assert.ok(imageCheck);
    assert.equal(imageCheck.severity, "required");
    assert.equal(imageCheck.ok, true);
    assert.match(imageCheck.detail, /template cover generation/);
  });

  it("requires scheduler status and install commands", async () => {
    const checks = await buildReadinessChecks();
    const dailyCheck = checks.find((check) => check.name === "daily generation command");

    assert.ok(dailyCheck);
    assert.equal(dailyCheck.severity, "required");
    assert.equal(dailyCheck.ok, true);
    assert.match(dailyCheck.detail, /status\/install/);
  });
});
