import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("project docs", () => {
  it("keeps the requirements document readable and aligned with the business brief", async () => {
    const requirements = await readFile("docs/requirements.md", "utf8");

    assert.match(requirements, /新加坡迷你仓/);
    assert.match(requirements, /小红书/);
    assert.match(requirements, /自己运/);
    assert.match(requirements, /帮运/);
    assert.match(requirements, /0\.5 元人民币以内/);
    assert.doesNotMatch(requirements, /涓|鏂|绾|鍔|�/);
  });
});
