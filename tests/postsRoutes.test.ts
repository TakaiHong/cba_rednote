import assert from "node:assert/strict";
import { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-routes-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));
process.env.XHS_PREFLIGHT_REPORT = relative(process.cwd(), join(tempRoot, "missing-preflight.json"));

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
    },
    scheduleStatusReader: async () => ({
      ok: true,
      installed: true,
      taskName: "XHS Mini Storage Daily Draft",
      state: "Ready",
      nextRunTime: "7/9/2026 9:15:00 AM",
      checkedAt: "2026-07-08T09:00:00.000Z",
      command: "npm.cmd run schedule:status",
      rawOutput: ["Installed: true"]
    }),
    handoffPackageGenerator: async (options) => ({
      outDir: options.outDir,
      files: {
        status: "status.json",
        readiness: "readiness-checks.json",
        goLive: "go-live-check.json",
        calendar: "content-calendar.md",
        batchDryRun: "batch-generation-dry-run.json",
        summary: "handoff-summary.md"
      }
    })
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

  it("exports a Markdown package for a selected post", async () => {
    const post = await postStore.createManual({
      title: "route export post",
      body: "body",
      tags: ["tag"],
      imageIdeas: ["image"],
      callToAction: "cta",
      status: "approved"
    });

    const response = await fetch(`${baseUrl}/api/posts/${post.id}/export-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outDir: relative(process.cwd(), join(tempRoot, "route-exports")) })
    });
    const payload = (await response.json()) as {
      postId: string;
      outputPath: string;
      filename: string;
    };

    assert.equal(response.status, 201);
    assert.equal(payload.postId, post.id);
    assert.match(payload.filename, /\.md$/);
    assert.match(payload.outputPath, /route-exports/);
  });

  it("exposes go-live status for the dashboard", async () => {
    const response = await fetch(`${baseUrl}/api/go-live`);
    const payload = (await response.json()) as {
      ok: boolean;
      missingExternalEvidence: string[];
      nextSteps: string[];
    };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, false);
    assert.ok(payload.missingExternalEvidence.includes("preflight evidence"));
    assert.ok(payload.nextSteps.some((step) => step.includes("publish:preflight")));
  });

  it("exposes daily task status for the dashboard", async () => {
    const response = await fetch(`${baseUrl}/api/schedule/status`);
    const payload = (await response.json()) as {
      installed: boolean;
      state: string;
      command: string;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.installed, true);
    assert.equal(payload.state, "Ready");
    assert.equal(payload.command, "npm.cmd run schedule:status");
  });

  it("generates a handoff package from the dashboard API", async () => {
    const response = await fetch(`${baseUrl}/api/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outDir: ".tmp/dashboard-handoff" })
    });
    const payload = (await response.json()) as {
      outDir: string;
      files: { summary: string; goLive: string };
    };

    assert.equal(response.status, 201);
    assert.equal(payload.outDir, ".tmp/dashboard-handoff");
    assert.equal(payload.files.summary, "handoff-summary.md");
    assert.equal(payload.files.goLive, "go-live-check.json");
  });
});
