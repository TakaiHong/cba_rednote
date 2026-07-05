import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveModelSettings } from "../server/src/modelConfig.js";

describe("resolveModelSettings", () => {
  it("uses the DeepSeek alias when no generic compatible key is set", () => {
    const settings = resolveModelSettings({
      DEEPSEEK_API_KEY: "ds-test-key"
    });

    assert.equal(settings.provider, "deepseek");
    assert.equal(settings.apiKey, "ds-test-key");
    assert.equal(settings.baseUrl, "https://api.deepseek.com");
    assert.equal(settings.model, "deepseek-v4-flash");
  });

  it("keeps explicit OpenAI-compatible settings ahead of provider aliases", () => {
    const settings = resolveModelSettings({
      OPENAI_API_KEY: "generic-key",
      OPENAI_BASE_URL: "https://example.com/v1",
      OPENAI_MODEL: "cheap-compatible-model",
      DEEPSEEK_API_KEY: "ds-test-key",
      DEEPSEEK_MODEL: "deepseek-v4-flash",
      MODEL_COST_CNY_PER_POST_ESTIMATE: "0.08"
    });

    assert.equal(settings.provider, "openai-compatible");
    assert.equal(settings.apiKey, "generic-key");
    assert.equal(settings.baseUrl, "https://example.com/v1");
    assert.equal(settings.model, "cheap-compatible-model");
    assert.equal(settings.estimatedCostCnyPerPost, 0.08);
  });
});
