import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-image-assets-"));
process.env.DATA_DIR = relative(process.cwd(), join(tempRoot, "data"));

const { prepareImageAssetBrief } = await import("../scripts/prepare-image-assets.js");
const { postStore } = await import("../server/src/storage/postStore.js");

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("prepareImageAssetBrief", () => {
  it("exports prompt-ready image handoff files for the latest approved post", async () => {
    await postStore.createManual({
      title: "回国两个月，行李先放哪里",
      body: "短期回国不想退租后到处借地方，迷你仓可以先过渡。",
      tags: ["新加坡留学", "迷你仓"],
      imageIdeas: ["两个行李箱和纸箱放在干净迷你仓门口"],
      callToAction: "私信物品清单，帮你估算仓型。",
      status: "approved"
    });

    const result = await prepareImageAssetBrief({
      post: "latest",
      outDir: relative(process.cwd(), join(tempRoot, "image-assets"))
    });

    const markdown = await readFile(join(result.outDir, result.files.markdown), "utf8");
    const prompt = await readFile(join(result.outDir, result.files.prompt), "utf8");
    const json = JSON.parse(await readFile(join(result.outDir, result.files.json), "utf8")) as {
      coverText: string;
      imagePrompt: string;
      uploadCommand: string;
    };

    assert.match(markdown, /图片素材包/);
    assert.match(markdown, /AI 出图 Prompt/);
    assert.match(markdown, /npm\.cmd run publish/);
    assert.match(prompt, /Singapore mini storage/);
    assert.equal(json.coverText, "回国两个月，行李先放哪里");
    assert.equal(json.imagePrompt, prompt.trim());
    assert.match(json.uploadCommand, /--images-dir/);
  });
});
