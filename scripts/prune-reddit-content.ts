import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNtuRelatedContent } from "./collect-reddit-content.js";
import { canonicalRedditPostUrl } from "./collect-reddit-links.js";

const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-content-corpus.jsonl");

interface StoredRecord {
  postUrl?: unknown;
  subreddit?: unknown;
  title?: unknown;
  body?: unknown;
  comments?: unknown;
}

function outputPath(args: string[]) {
  const index = args.indexOf("--out");
  const value = index >= 0 ? args[index + 1] : undefined;
  return path.resolve(value && !value.startsWith("--") ? value : DEFAULT_OUTPUT);
}

async function main() {
  const output = outputPath(process.argv.slice(2));
  const lines = (await readFile(output, "utf8")).split(/\r?\n/).filter(Boolean);
  const kept: string[] = [];
  const seenPostUrls = new Set<string>();
  let removed = 0;
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as StoredRecord;
      const subreddit = typeof record.subreddit === "string" ? record.subreddit : "";
      const title = typeof record.title === "string" ? record.title : "";
      const body = typeof record.body === "string" ? record.body : "";
      const comments = Array.isArray(record.comments) ? record.comments.filter((value): value is string => typeof value === "string") : [];
      const postUrl = typeof record.postUrl === "string" ? canonicalRedditPostUrl(record.postUrl) : undefined;
      if (postUrl && subreddit && isNtuRelatedContent(subreddit, title, body, comments) && !seenPostUrls.has(postUrl)) {
        kept.push(line);
        seenPostUrls.add(postUrl);
      } else {
        removed += 1;
      }
    } catch {
      removed += 1;
    }
  }
  const temporary = `${output}.next`;
  await writeFile(temporary, `${kept.join("\n")}${kept.length ? "\n" : ""}`, "utf8");
  await rename(temporary, output);
  console.log(`Kept ${kept.length} relevant Reddit content records and removed ${removed} records.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
