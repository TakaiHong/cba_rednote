export function shouldAttemptFinalPublish(requested: boolean, env: NodeJS.ProcessEnv, preflightReady = false) {
  return requested && env.XHS_ALLOW_FINAL_PUBLISH === "true" && preflightReady;
}

export function finalPublishGuardMessage(requested: boolean, env: NodeJS.ProcessEnv = {}, preflightReady = false) {
  if (!requested) return "Final publish click not requested.";
  if (env.XHS_ALLOW_FINAL_PUBLISH !== "true") {
    return "Final publish click requested but blocked. Set XHS_ALLOW_FINAL_PUBLISH=true to enable it.";
  }
  if (!preflightReady) {
    return "Final publish click requested but blocked. Run npm.cmd run publish:preflight and confirm selector evidence first.";
  }
  return "Final publish click enabled.";
}
