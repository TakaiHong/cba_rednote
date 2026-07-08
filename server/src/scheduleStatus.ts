import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DailyTaskStatus {
  ok: boolean;
  installed: boolean;
  taskName: string;
  state?: string;
  lastRunTime?: string;
  lastTaskResult?: string;
  nextRunTime?: string;
  detail?: string;
  checkedAt: string;
  command: string;
  rawOutput: string[];
}

function parseLineValue(line: string) {
  const separator = line.indexOf(":");
  if (separator === -1) return undefined;
  return {
    key: line.slice(0, separator).trim(),
    value: line.slice(separator + 1).trim()
  };
}

export function parseDailyTaskStatusOutput(output: string, command = "npm.cmd run schedule:status"): DailyTaskStatus {
  const rawOutput = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const values = new Map<string, string>();

  for (const line of rawOutput) {
    const parsed = parseLineValue(line);
    if (parsed) values.set(parsed.key, parsed.value);
  }

  const installed = values.get("Installed") === "true";

  return {
    ok: installed,
    installed,
    taskName: values.get("TaskName") ?? "XHS Mini Storage Daily Draft",
    state: values.get("State"),
    lastRunTime: values.get("LastRunTime"),
    lastTaskResult: values.get("LastTaskResult"),
    nextRunTime: values.get("NextRunTime"),
    detail: values.get("Detail"),
    checkedAt: new Date().toISOString(),
    command,
    rawOutput
  };
}

export async function getDailyTaskStatus(): Promise<DailyTaskStatus> {
  const command = "npm.cmd run schedule:status";
  try {
    const result = await execFileAsync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/check-daily-task.ps1"
    ]);
    return parseDailyTaskStatusOutput(result.stdout, command);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      installed: false,
      taskName: "XHS Mini Storage Daily Draft",
      detail,
      checkedAt: new Date().toISOString(),
      command,
      rawOutput: []
    };
  }
}
