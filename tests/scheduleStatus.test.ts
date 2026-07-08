import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDailyTaskStatusOutput } from "../server/src/scheduleStatus.js";

describe("parseDailyTaskStatusOutput", () => {
  it("parses installed task details", () => {
    const status = parseDailyTaskStatusOutput(
      [
        "TaskName: XHS Mini Storage Daily Draft",
        "Installed: true",
        "State: Ready",
        "LastRunTime: 7/8/2026 9:15:00 AM",
        "LastTaskResult: 0",
        "NextRunTime: 7/9/2026 9:15:00 AM"
      ].join("\n")
    );

    assert.equal(status.ok, true);
    assert.equal(status.installed, true);
    assert.equal(status.taskName, "XHS Mini Storage Daily Draft");
    assert.equal(status.state, "Ready");
    assert.equal(status.lastTaskResult, "0");
    assert.equal(status.nextRunTime, "7/9/2026 9:15:00 AM");
  });

  it("parses missing task output as actionable status", () => {
    const status = parseDailyTaskStatusOutput(
      [
        "TaskName: XHS Mini Storage Daily Draft",
        "Installed: false",
        "Detail: Run npm.cmd run schedule:install to create the daily draft task."
      ].join("\n")
    );

    assert.equal(status.ok, false);
    assert.equal(status.installed, false);
    assert.match(status.detail ?? "", /schedule:install/);
  });
});
