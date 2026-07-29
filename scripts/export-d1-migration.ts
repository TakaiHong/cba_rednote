import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type StoredPost = { id: string; createdAt: string; updatedAt: string };
type StoredLog = { id: string; action: string; status: string; message: string; metadata?: Record<string, unknown>; createdAt: string };

function quote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function readJson<T>(path: string, fallback: T) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const outputIndex = process.argv.indexOf("--out");
const output = resolve(process.cwd(), outputIndex >= 0 ? process.argv[outputIndex + 1] : ".tmp/d1-migration.sql");
const posts = await readJson<StoredPost[]>(resolve(process.cwd(), "data", "ntu-cba", "posts.json"), []);
const logs = await readJson<StoredLog[]>(resolve(process.cwd(), "data", "run-log.json"), []);

const statements = ["BEGIN TRANSACTION;"];
for (const post of posts) {
  statements.push(
    `INSERT INTO posts (id, payload, created_at, updated_at) VALUES (${quote(post.id)}, ${quote(JSON.stringify(post))}, ${quote(post.createdAt)}, ${quote(post.updatedAt)}) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;`
  );
}
for (const log of logs) {
  statements.push(
    `INSERT INTO run_logs (id, action, status, message, metadata, created_at) VALUES (${quote(log.id)}, ${quote(log.action)}, ${quote(log.status)}, ${quote(log.message)}, ${quote(JSON.stringify(log.metadata ?? {}))}, ${quote(log.createdAt)}) ON CONFLICT(id) DO UPDATE SET action = excluded.action, status = excluded.status, message = excluded.message, metadata = excluded.metadata, created_at = excluded.created_at;`
  );
}
statements.push("COMMIT;");

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${statements.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ output, posts: posts.length, logs: logs.length }, null, 2));
