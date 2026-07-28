import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalPublishGuardMessage, shouldAttemptFinalPublish } from "../server/src/publishing/finalPublish.js";

describe("final publish guard", () => {
  it("always keeps the final click manual", () => {
    assert.equal(shouldAttemptFinalPublish(false, { XHS_ALLOW_FINAL_PUBLISH: "true" }, true), false);
    assert.equal(shouldAttemptFinalPublish(true, { XHS_ALLOW_FINAL_PUBLISH: "false" }, true), false);
    assert.equal(shouldAttemptFinalPublish(true, { XHS_ALLOW_FINAL_PUBLISH: "true" }, false), false);
    assert.equal(shouldAttemptFinalPublish(true, { XHS_ALLOW_FINAL_PUBLISH: "true" }, true), false);
  });

  it("explains why the final click is skipped", () => {
    assert.match(finalPublishGuardMessage(false), /manual/);
    assert.match(finalPublishGuardMessage(true, { XHS_ALLOW_FINAL_PUBLISH: "true" }, false), /manual/);
  });
});
