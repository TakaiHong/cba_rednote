import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readJson<T>(path: string, fallback: T) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const apiUrl = process.env.SITES_API_URL?.replace(/\/$/, "");
const token = process.env.SITES_MIGRATION_TOKEN;
if (!apiUrl || !token) {
  throw new Error("Set SITES_API_URL and SITES_MIGRATION_TOKEN before migrating local data.");
}

const posts = await readJson(resolve(process.cwd(), "data", "ntu-cba", "posts.json"), []);
const logs = await readJson(resolve(process.cwd(), "data", "run-log.json"), []);
const response = await fetch(`${apiUrl}/api/internal/migrate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Migration-Token": token },
  body: JSON.stringify({ posts, logs })
});
if (!response.ok) throw new Error(await response.text());
console.log(JSON.stringify(await response.json(), null, 2));
