import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { firestoreDb } from "../server/src/storage/firebaseAdmin.js";
import type { MarketingPost, RunLogEntry } from "../server/src/types.js";

const database = firestoreDb();
if (!database) {
  throw new Error("Set PERSISTENCE_PROVIDER=firestore and Google application credentials before migration.");
}
const firestore = database;

async function readJson<T>(path: string): Promise<T[]> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeCollection<T extends { id: string }>(collection: string, records: T[]) {
  for (let start = 0; start < records.length; start += 400) {
    const batch = firestore.batch();
    for (const record of records.slice(start, start + 400)) {
      batch.set(firestore.collection(collection).doc(record.id), record);
    }
    await batch.commit();
  }
}

const postsPath = process.env.DATA_DIR
  ? join(process.cwd(), process.env.DATA_DIR, "posts.json")
  : join(process.cwd(), "data", "ntu-cba", "posts.json");
const runLogPath = join(process.cwd(), "data", "run-log.json");
const posts = await readJson<MarketingPost>(postsPath);
const runLogs = await readJson<RunLogEntry>(runLogPath);

await writeCollection("ntu-cba-posts", posts);
await writeCollection("ntu-cba-run-logs", runLogs);

console.log(JSON.stringify({ migratedPosts: posts.length, migratedRunLogs: runLogs.length }, null, 2));
