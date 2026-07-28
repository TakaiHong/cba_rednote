export function shouldAttemptFinalPublish(_requested: boolean, _env: NodeJS.ProcessEnv, _preflightReady = false) {
  // Platform policy: do not automate the final Xiaohongshu publish click.
  // It is both safer for the account and avoids presenting an automation pattern as normal operations.
  return false;
}

export function finalPublishGuardMessage(_requested: boolean, _env: NodeJS.ProcessEnv = {}, _preflightReady = false) {
  return "Final publish is intentionally manual. Copy the prepared package and publish in Xiaohongshu yourself.";
}
