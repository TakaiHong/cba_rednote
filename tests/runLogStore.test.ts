import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-run-log-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { runLogStore } = await import("../server/src/storage/runLogStore.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("runLogStore", () => {
  it("appends and lists recent run log entries first", async () => {
    await runLogStore.append({ action: "generate", status: "ok", message: "first" });
    const latest = await runLogStore.append({
      action: "handoff",
      status: "ok",
      message: "second",
      metadata: { count: 1 }
    });

    const entries = await runLogStore.list();

    assert.equal(entries[0].id, latest.id);
    assert.equal(entries[0].metadata?.count, 1);
    assert.equal(entries.length, 2);
  });
});
