import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-export-package-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { exportXhsMarkdownPackage } = await import("../server/src/publishing/exportPackage.js");
const { postStore } = await import("../server/src/storage/postStore.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("exportXhsMarkdownPackage", () => {
  it("writes a Markdown package for a selected post", async () => {
    const post = await postStore.createManual({
      title: "导出测试标题",
      body: "这是一条导出测试正文。",
      tags: ["新加坡迷你仓"],
      imageIdeas: ["纸箱和行李箱"],
      callToAction: "私信了解"
    });

    const result = await exportXhsMarkdownPackage(post, relative(process.cwd(), join(tempRoot, "exports")));
    const markdown = await readFile(result.outputPath, "utf8");

    assert.equal(result.postId, post.id);
    assert.match(result.filename, /\.md$/);
    assert.match(markdown, /导出测试标题/);
    assert.match(markdown, /#新加坡迷你仓/);
  });
});
