import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanTextForSecrets } from "../scripts/check-secrets.js";

const fakeSecret = ["s", "k", "-", "1234567890abcdef1234567890abcdef"].join("");
const deepseekEnvName = ["DEEPSEEK", "API", "KEY"].join("_");
const openaiEnvName = ["OPENAI", "API", "KEY"].join("_");

describe("scanTextForSecrets", () => {
  it("allows empty values and documented placeholders", () => {
    const findings = scanTextForSecrets(
      "docs/example.md",
      [`${deepseekEnvName}=`, `${deepseekEnvName}=sk-your-key`, `${openaiEnvName}=your-compatible-key`].join("\n")
    );

    assert.deepEqual(findings, []);
  });

  it("flags real-looking API keys in tracked text", () => {
    const findings = scanTextForSecrets(
      ".env.example",
      [`${deepseekEnvName}=${fakeSecret}`, "OPENAI_MODEL=gpt-4.1-mini"].join("\n")
    );

    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, ".env.example");
    assert.equal(findings[0].line, 1);
  });

  it("flags long secret-shaped tokens outside env assignments", () => {
    const findings = scanTextForSecrets("README.md", `paste ${fakeSecret} here`);

    assert.equal(findings.length, 1);
    assert.match(findings[0].reason, /token/);
  });
});
