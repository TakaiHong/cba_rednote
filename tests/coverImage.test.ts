import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { renderCoverHtml, resolveChromePath, safeFilename } from "../scripts/generate-cover-image.js";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-cover-"));

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("cover image helpers", () => {
  it("cleans unsafe filename characters", () => {
    assert.equal(safeFilename('NTU: move / storage * "cheap"?'), "NTU move storage cheap");
  });

  it("renders escaped Xiaohongshu cover HTML", () => {
    const html = renderCoverHtml({
      title: "cheap <storage>",
      coverText: "回国 <两个月>",
      scene: "lease gap & luggage",
      imageIdea: "boxes > sofa",
      tags: ["#新加坡", "迷你仓"]
    });

    assert.match(html, /1080px/);
    assert.match(html, /1440px/);
    assert.match(html, /回国 &lt;两个月&gt;/);
    assert.match(html, /lease gap &amp; luggage/);
    assert.match(html, /boxes &gt; sofa/);
    assert.doesNotMatch(html, /cheap <storage>/);
  });

  it("resolves the first available Chrome candidate", async () => {
    const missing = join(tempRoot, "missing-chrome.exe");
    const present = join(tempRoot, "chrome.exe");
    await writeFile(present, "", "utf8");

    assert.equal(resolveChromePath([missing, present]), present);
    assert.equal(resolveChromePath([missing]), undefined);
  });
});
