import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { RunLogEntry } from "../types.js";

const dataDir = process.env.DATA_DIR ? join(process.cwd(), process.env.DATA_DIR) : join(process.cwd(), "data");
const dataFile = join(dataDir, "run-log.json");

async function ensureDataFile() {
  await mkdir(dirname(dataFile), { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readEntries(): Promise<RunLogEntry[]> {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  try {
    return JSON.parse(raw) as RunLogEntry[];
  } catch {
    const corruptFile = `${dataFile}.corrupt-${Date.now()}`;
    await rename(dataFile, corruptFile);
    await writeFile(dataFile, "[]\n", "utf8");
    console.warn(`[runLogStore] moved corrupt data file to ${corruptFile}`);
    return [];
  }
}

async function writeEntries(entries: RunLogEntry[]) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export const runLogStore = {
  async list(limit = 20) {
    const entries = await readEntries();
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },

  async append(input: Omit<RunLogEntry, "id" | "createdAt">) {
    const entry: RunLogEntry = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...input
    };
    const entries = await readEntries();
    entries.push(entry);
    await writeEntries(entries.slice(-500));
    return entry;
  }
};
