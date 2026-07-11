import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-backup-"));
const originalDataDir = process.env.DATA_DIR;
const testDataDir = relative(process.cwd(), join(tempRoot, "data"));
process.env.DATA_DIR = testDataDir;

const { backupRuntimeData } = await import("../server/src/backup.js");

after(async () => {
  if (originalDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = originalDataDir;
  }
  await rm(tempRoot, { force: true, recursive: true });
});

describe("backupRuntimeData", () => {
  it("copies the runtime posts data into a backup file", async () => {
    await mkdir(join(tempRoot, "data"), { recursive: true });
    await writeFile(join(tempRoot, "data", "posts.json"), JSON.stringify([{ title: "backup me" }]), "utf8");

    const result = await backupRuntimeData(relative(process.cwd(), join(tempRoot, "backups")), new Date(2026, 6, 11, 5, 0, 1));

    assert.equal(result.ok, true);
    assert.equal(result.created, true);
    assert.match(result.target ?? "", /posts-20260711-050001\.json$/);
    assert.match(await readFile(result.target ?? "", "utf8"), /backup me/);
  });

  it("returns a no-op result when no data file exists", async () => {
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "missing-data"));

    try {
      const result = await backupRuntimeData(relative(process.cwd(), join(tempRoot, "missing-backups")));

      assert.equal(result.ok, true);
      assert.equal(result.created, false);
      assert.match(result.detail, /Nothing to back up/);
    } finally {
      process.env.DATA_DIR = previousDataDir;
    }
  });
});
