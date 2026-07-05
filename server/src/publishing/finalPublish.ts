export function shouldAttemptFinalPublish(requested: boolean, env: NodeJS.ProcessEnv) {
  return requested && env.XHS_ALLOW_FINAL_PUBLISH === "true";
}

export function finalPublishGuardMessage(requested: boolean) {
  if (!requested) return "Final publish click not requested.";
  return "Final publish click requested but blocked. Set XHS_ALLOW_FINAL_PUBLISH=true to enable it.";
}
