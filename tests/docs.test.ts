import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("project docs", () => {
  const docs = [
    "docs/requirements.md",
    "docs/operations-runbook.md",
    "docs/xiaohongshu-publishing.md",
    "docs/architecture.md",
    "docs/code-map.md",
    "docs/acceptance-checklist.md"
  ];

  it("keeps core handoff documents readable", async () => {
    for (const path of docs) {
      const content = await readFile(path, "utf8");
      assert.doesNotMatch(content, /涓|鏂|绾|鍔|灏|杩|�/, path);
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
});
