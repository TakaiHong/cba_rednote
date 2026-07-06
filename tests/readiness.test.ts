import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-readiness-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));
process.env.XHS_PREFLIGHT_REPORT = relative(process.cwd(), join(tempRoot, "preflight.json"));

const { postStore } = await import("../server/src/storage/postStore.js");
const { readPreflightEvidence, readPublishedUrlEvidence } = await import("../scripts/readiness.js");

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
});
