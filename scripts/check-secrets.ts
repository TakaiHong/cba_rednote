import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SecretFinding {
  file: string;
  line: number;
  reason: string;
}

const keyPrefix = ["s", "k", "-"].join("");
const longSecretPattern = new RegExp(`${keyPrefix}[A-Za-z0-9_-]{20,}`);
const keyAssignmentPattern = new RegExp(
  String.raw`\b(?:OPENAI_API_KEY|DEEPSEEK_API_KEY)\s*=\s*["']?([^"'\s#]+)`,
  "i"
);

const allowedPlaceholders = new Set(["", "sk-your-key", "your-compatible-key", "<url>", "<key>"]);

function isAllowedPlaceholder(value: string) {
  return allowedPlaceholders.has(value.trim()) || value.includes("...");
}

export function scanTextForSecrets(file: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const assignment = keyAssignmentPattern.exec(line);
    if (assignment && !isAllowedPlaceholder(assignment[1])) {
      findings.push({
        file,
        line: index + 1,
        reason: "API key environment variable has a non-placeholder value"
      });
      return;
    }

    if (longSecretPattern.test(line)) {
      findings.push({
        file,
        line: index + 1,
        reason: "line contains a token shaped like a real API key"
      });
    }
  });

  return findings;
}

async function listTrackedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files"], { encoding: "utf8" });
  return stdout.split(/\r?\n/).filter(Boolean);
}

export async function scanTrackedFiles() {
  const files = await listTrackedFiles();
  const findings: SecretFinding[] = [];

  for (const file of files) {
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (text === undefined) continue;
    findings.push(...scanTextForSecrets(file, text));
  }

  return findings;
}

if (process.argv[1]?.endsWith("check-secrets.ts") || process.argv[1]?.endsWith("check-secrets.js")) {
  const findings = await scanTrackedFiles();
  if (findings.length > 0) {
    console.error("Potential committed secrets found:");
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line} ${finding.reason}`);
    }
    process.exit(1);
  }

  console.log("No tracked API secrets found.");
}
