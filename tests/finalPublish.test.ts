import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalPublishGuardMessage, shouldAttemptFinalPublish } from "../server/src/publishing/finalPublish.js";

describe("final publish guard", () => {
  it("requires both a CLI request and an environment opt-in", () => {
    assert.equal(shouldAttemptFinalPublish(false, { XHS_ALLOW_FINAL_PUBLISH: "true" }), false);
    assert.equal(shouldAttemptFinalPublish(true, { XHS_ALLOW_FINAL_PUBLISH: "false" }), false);
    assert.equal(shouldAttemptFinalPublish(true, { XHS_ALLOW_FINAL_PUBLISH: "true" }), true);
  });

  it("explains why the final click is skipped", () => {
    assert.equal(finalPublishGuardMessage(false), "Final publish click not requested.");
    assert.equal(
      finalPublishGuardMessage(true),
      "Final publish click requested but blocked. Set XHS_ALLOW_FINAL_PUBLISH=true to enable it."
    );
  });
});
