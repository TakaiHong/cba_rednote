import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { resolveImageInputs } from "../server/src/publishing/imageInputs.js";

const tempRoot = await mkdtemp(join(tmpdir(), "xhs-images-"));

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe("resolveImageInputs", () => {
  it("deduplicates explicit images and supported directory images", async () => {
    const imagesDir = join(tempRoot, "images");
    await mkdir(imagesDir, { recursive: true });
    await writeFile(join(imagesDir, "cover.png"), "x", "utf8");
    await writeFile(join(imagesDir, "detail.webp"), "x", "utf8");
    await writeFile(join(imagesDir, "notes.txt"), "x", "utf8");

    const explicit = join(imagesDir, "cover.png");
    const resolved = await resolveImageInputs({
      imagePaths: [explicit],
      imagesDir
    });

    assert.deepEqual(resolved, [resolve(explicit), resolve(join(imagesDir, "detail.webp"))]);
  });
});
