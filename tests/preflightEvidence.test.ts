import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { readPreflightEvidence } from "../server/src/publishing/preflightEvidence.js";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-preflight-evidence-"));

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("readPreflightEvidence", () => {
  it("returns missing selector groups for incomplete reports", async () => {
    const reportPath = join(tempRoot, "partial-preflight.json");
    await writeFile(
      reportPath,
      JSON.stringify({
        generatedAt: "2026-07-11T00:00:00.000Z",
        selectors: {
          title: [{ selector: "title", count: 1, visible: true }],
          body: [{ selector: "body", count: 1, visible: true }],
          upload: [{ selector: "upload", count: 1, visible: false }],
          publishButton: []
        },
        diagnostics: {
          visibleButtons: [
            {
              tag: "button",
              text: "发布笔记",
              ariaLabel: "",
              role: "",
              className: "publish",
              visible: true
            }
          ]
        }
      }),
      "utf8"
    );

    const evidence = await readPreflightEvidence(reportPath);

    assert.equal(evidence.ok, false);
    assert.deepEqual(evidence.missingGroups, ["publishButton"]);
    assert.equal(evidence.groups.title.ok, true);
    assert.equal(evidence.groups.upload.ok, true);
    assert.equal(evidence.diagnostics.visibleButtons[0].text, "发布笔记");
    assert.match(evidence.detail, /publishButton/);
  });

  it("returns a structured no-report result when the file is missing", async () => {
    const missingPath = join(tempRoot, "missing.json");
    const evidence = await readPreflightEvidence(missingPath);

    assert.equal(evidence.ok, false);
    assert.equal(evidence.path, missingPath);
    assert.deepEqual(evidence.missingGroups, ["title", "body", "upload", "publishButton"]);
    assert.equal(evidence.groups.publishButton.selectors.length, 0);
    assert.deepEqual(evidence.diagnostics.visibleButtons, []);
    assert.match(evidence.detail, /No usable preflight report/);
  });

  it("accepts complete selector evidence generated within 24 hours", async () => {
    const reportPath = join(tempRoot, "fresh-preflight.json");
    const selectors = Object.fromEntries(
      ["title", "body", "upload", "publishButton"].map((group) => [
        group,
        [{ selector: group, count: 1, visible: true }]
      ])
    );
    await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), selectors }), "utf8");

    const evidence = await readPreflightEvidence(reportPath);

    assert.equal(evidence.ok, true);
    assert.equal(evidence.stale, false);
    assert.equal(evidence.missingGroups.length, 0);
  });

  it("rejects otherwise complete selector evidence after 24 hours", async () => {
    const reportPath = join(tempRoot, "stale-preflight.json");
    const selectors = Object.fromEntries(
      ["title", "body", "upload", "publishButton"].map((group) => [
        group,
        [{ selector: group, count: 1, visible: true }]
      ])
    );
    await writeFile(reportPath, JSON.stringify({ generatedAt: "2025-01-01T00:00:00.000Z", selectors }), "utf8");

    const evidence = await readPreflightEvidence(reportPath);

    assert.equal(evidence.ok, false);
    assert.equal(evidence.stale, true);
    assert.equal(evidence.missingGroups.length, 0);
    assert.match(evidence.detail, /stale/);
  });
});
