import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-scheduler-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));
process.env.DEEPSEEK_API_KEY = "";
process.env.OPENAI_API_KEY = "";

const { runScheduledGeneration } = await import("../server/src/scheduler.js");
const { postStore } = await import("../server/src/storage/postStore.js");
const { runLogStore } = await import("../server/src/storage/runLogStore.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("runScheduledGeneration", () => {
  it("creates a draft and records scheduler evidence", async () => {
    const post = await runScheduledGeneration();
    const posts = await postStore.list();
    const runs = await runLogStore.list();

    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, post.id);
    assert.equal(runs[0].action, "scheduler-generate");
    assert.equal(runs[0].status, "ok");
    assert.equal(runs[0].metadata?.postId, post.id);
    assert.equal(post.estimatedCostCny <= 0.5, true);
  });
});
