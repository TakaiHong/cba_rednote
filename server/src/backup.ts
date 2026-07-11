import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

function timestampForFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

export interface BackupResult {
  ok: boolean;
  source: string;
  target?: string;
  outDir: string;
  created: boolean;
  detail: string;
  generatedAt: string;
}

export async function backupRuntimeData(outDir = "backups", now = new Date()): Promise<BackupResult> {
  const source = join(process.env.DATA_DIR ?? "data", "posts.json");
  const absoluteOutDir = join(process.cwd(), outDir);
  const target = join(absoluteOutDir, `posts-${timestampForFilename(now)}.json`);
  const generatedAt = now.toISOString();

  try {
    await stat(source);
  } catch {
    return {
      ok: true,
      source,
      outDir: absoluteOutDir,
      created: false,
      detail: `No data file found at ${source}. Nothing to back up.`,
      generatedAt
    };
  }

  await mkdir(absoluteOutDir, { recursive: true });
  await copyFile(source, target);

  return {
    ok: true,
    source,
    target,
    outDir: absoluteOutDir,
    created: true,
    detail: `Backup created: ${target}`,
    generatedAt
  };
}
