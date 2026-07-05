import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadXhsSelectorConfig } from "../server/src/publishing/selectorConfig.js";

describe("loadXhsSelectorConfig", () => {
  it("loads required selector groups from config", async () => {
    const config = await loadXhsSelectorConfig();

    assert.equal(config.title.length > 0, true);
    assert.equal(config.body.length > 0, true);
    assert.equal(Array.isArray(config.publishButton), true);
    assert.equal(Array.isArray(config.upload), true);
  });
});
