import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

function fromCodePoints(values: number[]) {
  return values.map((codePoint) => String.fromCodePoint(codePoint)).join("");
}

const mojibakePattern = new RegExp(
  [
    [0x93c2, 0x677f],
    [0x9354, 0x72b2],
    [0x704f, 0x5fd5],
    [0x6769, 0x612f],
    [0x7efe, 0xe76d],
    [0x6d93, 0x20ac]
  ]
    .map(fromCodePoints)
    .join("|") + "|\\uFFFD"
);

describe("project docs", () => {
  const docs = [
    "docs/requirements.md",
    "docs/operations-runbook.md",
    "docs/xiaohongshu-publishing.md",
    "docs/architecture.md",
    "docs/code-map.md",
    "docs/acceptance-checklist.md",
    "docs/model-config.md"
  ];

  it("keeps core handoff documents readable", async () => {
    for (const path of docs) {
      const content = await readFile(path, "utf8");
      assert.doesNotMatch(content, mojibakePattern, path);
    }
  });

  it("keeps the requirements document aligned with the business brief", async () => {
    const requirements = await readFile("docs/requirements.md", "utf8");

    for (const keyword of ["新加坡迷你仓", "小红书", "自己运", "帮运", "0.5 元人民币以内"]) {
      assert.match(requirements, new RegExp(keyword));
    }
  });

  it("documents the guarded Xiaohongshu publishing workflow", async () => {
    const publishing = await readFile("docs/xiaohongshu-publishing.md", "utf8");
    const runbook = await readFile("docs/operations-runbook.md", "utf8");

    for (const keyword of ["publish:preflight", "XHS_ALLOW_FINAL_PUBLISH=true", "--click-publish"]) {
      assert.match(publishing, new RegExp(keyword));
      assert.match(runbook, new RegExp(keyword));
    }
  });

  it("documents model safety and image generation boundaries", async () => {
    const modelConfig = await readFile("docs/model-config.md", "utf8");
    const acceptance = await readFile("docs/acceptance-checklist.md", "utf8");

    for (const keyword of ["DeepSeek", "Image Generation", "secrets:scan", "imagePrompt"]) {
      assert.match(modelConfig, new RegExp(keyword));
    }

    for (const keyword of ["secrets:scan", "图片", "发布脚本", "image:cover"]) {
      assert.match(acceptance, new RegExp(keyword));
    }
  });

  it("documents the go-live gate separately from local readiness", async () => {
    const readme = await readFile("README.md", "utf8");
    const requirements = await readFile("docs/requirements.md", "utf8");
    const runbook = await readFile("docs/operations-runbook.md", "utf8");
    const codeMap = await readFile("docs/code-map.md", "utf8");
    const acceptance = await readFile("docs/acceptance-checklist.md", "utf8");

    for (const content of [requirements, runbook, acceptance]) {
      assert.match(content, /go-live:check/);
    }
    for (const content of [readme, runbook, codeMap, acceptance]) {
      assert.match(content, /go-live-check\.json/);
    }
    assert.match(acceptance, /real-account preflight report/);
    assert.match(acceptance, /published Xiaohongshu URL/);
  });

  it("documents scheduler status checks for handoff", async () => {
    const readme = await readFile("README.md", "utf8");
    const runbook = await readFile("docs/operations-runbook.md", "utf8");
    const codeMap = await readFile("docs/code-map.md", "utf8");
    const acceptance = await readFile("docs/acceptance-checklist.md", "utf8");

    for (const content of [readme, runbook, codeMap, acceptance]) {
      assert.match(content, /schedule:status/);
    }
    assert.match(readme, /每日自动化状态/);
    assert.match(codeMap, /每日自动化状态/);
  });

  it("documents dashboard handoff command shortcuts", async () => {
    const readme = await readFile("README.md", "utf8");
    const codeMap = await readFile("docs/code-map.md", "utf8");

    assert.match(readme, /交接命令/);
    assert.match(codeMap, /交接命令复制区/);
  });
});
