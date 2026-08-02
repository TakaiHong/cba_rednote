import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { RedditEvidenceCard } from "./build-reddit-evidence-cards.js";

const DEFAULT_INPUT = path.resolve(".tmp", "reddit-ntu-evidence-cards.json");
const DATABASE = "ntu-cba-content-db";

function sqlQuote(value: string) { return `'${value.replace(/'/g, "''")}'`; }
function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Wrangler exited with ${code ?? "unknown"}.`)));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--in");
  const requestedInput = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const input = path.resolve(requestedInput && !requestedInput.startsWith("--") ? requestedInput : DEFAULT_INPUT);
  const dryRun = args.includes("--dry-run");
  const payload = JSON.parse(await readFile(input, "utf8")) as { cards?: RedditEvidenceCard[] };
  const cards = (payload.cards ?? []).slice(0, 400);
  if (!cards.length) throw new Error("No evidence cards found. Run reddit:build-evidence first.");
  const statements = cards.map((card) => {
    const id = `reddit-evidence-${crypto.randomUUID()}`;
    const json = JSON.stringify({ ...card, id });
    // D1 stores signal payloads as JSON. Removing a matching source URL first
    // makes repeated corpus refreshes idempotent without storing any raw text.
    return `DELETE FROM knowledge_entries WHERE json_extract(payload, '$.sourceUrl') = ${sqlQuote(card.sourceUrl)};\nINSERT INTO knowledge_entries (id, payload, created_at, updated_at) VALUES (${sqlQuote(id)}, ${sqlQuote(json)}, ${sqlQuote(card.createdAt)}, ${sqlQuote(card.updatedAt)});`;
  });
  const sqlPath = path.resolve(".tmp", "reddit-evidence-import.sql");
  await (await import("node:fs/promises")).writeFile(sqlPath, statements.join("\n"), "utf8");
  console.log(JSON.stringify({ cards: cards.length, sqlPath, dryRun }, null, 2));
  if (dryRun) return;
  if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is required to import evidence into D1.");
  await run(process.platform === "win32" ? "npx.cmd" : "npx", ["wrangler", "d1", "execute", DATABASE, "--remote", "--file", sqlPath, "--config", "worker/wrangler.toml"]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
