import assert from "node:assert/strict";
import { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-routes-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { createApp } = await import("../server/src/app.js");
const { postStore } = await import("../server/src/storage/postStore.js");

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp({
    posts: {
      coverImageGenerator: async (options) => {
        const outputPath = join(tempRoot, "generated-cover.png");
        if (options.attach) {
          const post = await postStore.get(options.post);
          await postStore.update(options.post, {
            imageAssets: [...(post?.imageAssets ?? []), outputPath]
          });
        }
        return {
          postId: options.post,
          outputPath,
          attached: options.attach
        };
      }
    }
  }).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(tempRoot, { force: true, recursive: true });
});

describe("posts routes", () => {
  it("rejects marking a post published without URL evidence", async () => {
    const post = await postStore.createManual({
      title: "route post",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });

    const response = await fetch(`${baseUrl}/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" })
    });
    const payload = (await response.json()) as { error: string };

    assert.equal(response.status, 400);
    assert.match(payload.error, /publishedUrl/);
    assert.equal((await postStore.get(post.id))?.status, "approved");
  });

  it("accepts published status when a valid URL is recorded", async () => {
    const post = await postStore.createManual({
      title: "published route post",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });

    const response = await fetch(`${baseUrl}/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "published",
        publishedUrl: " https://www.xiaohongshu.com/explore/example "
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "published");
    assert.equal(payload.publishedUrl, "https://www.xiaohongshu.com/explore/example");
  });

  it("generates and attaches a template cover image for a post", async () => {
    const post = await postStore.createManual({
      title: "cover route post",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });

    const response = await fetch(`${baseUrl}/api/posts/${post.id}/cover-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as {
      postId: string;
      outputPath: string;
      attached: boolean;
      post: { imageAssets: string[] };
    };

    assert.equal(response.status, 201);
    assert.equal(payload.postId, post.id);
    assert.equal(payload.attached, true);
    assert.match(payload.outputPath, /generated-cover\.png$/);
    assert.deepEqual(payload.post.imageAssets, [payload.outputPath]);
    assert.deepEqual((await postStore.get(post.id))?.imageAssets, [payload.outputPath]);
  });
});
