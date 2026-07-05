import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-store-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { postStore } = await import("../server/src/storage/postStore.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("postStore", () => {
  it("creates, updates, and preserves metrics", async () => {
    const post = await postStore.createManual({
      title: "manual",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      metrics: { views: 10, inquiries: 2 }
    });

    assert.equal(post.metrics.views, 10);
    assert.equal(post.metrics.inquiries, 2);
    assert.equal(post.metrics.likes, 0);

    const updated = await postStore.update(post.id, { metrics: { likes: 3 }, status: "published" });
    assert.equal(updated?.metrics.views, 10);
    assert.equal(updated?.metrics.likes, 3);
    assert.equal(updated?.status, "published");
    assert.ok(updated?.publishedAt);
  });

  it("backs up corrupt data and recovers with an empty list", async () => {
    const dataPath = join(tempRoot, "data");
    await mkdir(dataPath, { recursive: true });
    await writeFile(join(dataPath, "posts.json"), "{not-json", "utf8");

    const posts = await postStore.list();
    assert.deepEqual(posts, []);
  });
});
