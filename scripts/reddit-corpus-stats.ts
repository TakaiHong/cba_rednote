import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redditSubreddit } from "./collect-reddit-links.js";

const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-content-corpus.jsonl");
const DEFAULT_TARGET_POSTS = 10_000;
const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024;
const ALLOWED_SUBREDDITS = new Set(["ntu", "sgexams", "asksingapore", "singapore", "sit_singapore"]);
const REDACTION_PATTERN = /\[(?:email|phone|link|user) removed\]/i;

interface CorpusRecord {
  postUrl?: unknown;
  subreddit?: unknown;
  title?: unknown;
  body?: unknown;
  comments?: unknown;
}

export interface CorpusStats {
  corpusPath: string;
  bytes: number;
  targetPosts: number;
  maxBytes: number;
  totalLines: number;
  validRecords: number;
  invalidLines: number;
  allowedSourceRecords: number;
  outsideWhitelistRecords: number;
  recordsWithPostBody: number;
  recordsWithComments: number;
  recordsWithRedactions: number;
  communities: Record<string, number>;
  averageTextChars: number;
  medianTextChars: number;
  goalReached: boolean;
}

function numberOption(args: string[], flag: string, fallback: number) {
  const index = args.indexOf(flag);
  const value = index >= 0 ? Number(args[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function stringOption(args: string[], flag: string) {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function comments(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function summarizeCorpusLines(lines: string[], corpusPath: string, bytes: number, targetPosts = DEFAULT_TARGET_POSTS, maxBytes = DEFAULT_MAX_BYTES): CorpusStats {
  const communities = new Map<string, number>();
  const textLengths: number[] = [];
  let validRecords = 0;
  let invalidLines = 0;
  let allowedSourceRecords = 0;
  let outsideWhitelistRecords = 0;
  let recordsWithPostBody = 0;
  let recordsWithComments = 0;
  let recordsWithRedactions = 0;

  for (const line of lines.filter(Boolean)) {
    let record: CorpusRecord;
    try {
      record = JSON.parse(line) as CorpusRecord;
    } catch {
      invalidLines += 1;
      continue;
    }
    validRecords += 1;
    const subreddit = text(record.subreddit).toLowerCase() || redditSubreddit(text(record.postUrl)) || "unknown";
    communities.set(subreddit, (communities.get(subreddit) ?? 0) + 1);
    if (ALLOWED_SUBREDDITS.has(subreddit)) allowedSourceRecords += 1;
    else outsideWhitelistRecords += 1;

    const body = text(record.body);
    const visibleComments = comments(record.comments);
    if (body) recordsWithPostBody += 1;
    if (visibleComments.length > 0) recordsWithComments += 1;
    const corpusText = [text(record.title), body, ...visibleComments].join("\n");
    if (REDACTION_PATTERN.test(corpusText)) recordsWithRedactions += 1;
    textLengths.push(corpusText.length);
  }

  const sortedLengths = [...textLengths].sort((left, right) => left - right);
  const middle = Math.floor(sortedLengths.length / 2);
  const medianTextChars = sortedLengths.length === 0 ? 0 : sortedLengths.length % 2 === 0
    ? Math.round((sortedLengths[middle - 1] + sortedLengths[middle]) / 2)
    : sortedLengths[middle];
  return {
    corpusPath,
    bytes,
    targetPosts,
    maxBytes,
    totalLines: lines.filter(Boolean).length,
    validRecords,
    invalidLines,
    allowedSourceRecords,
    outsideWhitelistRecords,
    recordsWithPostBody,
    recordsWithComments,
    recordsWithRedactions,
    communities: Object.fromEntries([...communities.entries()].sort(([left], [right]) => left.localeCompare(right))),
    averageTextChars: textLengths.length === 0 ? 0 : Math.round(textLengths.reduce((sum, length) => sum + length, 0) / textLengths.length),
    medianTextChars,
    goalReached: validRecords >= targetPosts || bytes >= maxBytes
  };
}

async function main() {
  const args = process.argv.slice(2);
  const corpusPath = path.resolve(stringOption(args, "--out") || DEFAULT_OUTPUT);
  const targetPosts = numberOption(args, "--target-posts", DEFAULT_TARGET_POSTS);
  const maxBytes = numberOption(args, "--max-bytes", DEFAULT_MAX_BYTES);
  let contents = "";
  let bytes = 0;
  try {
    [contents, { size: bytes }] = await Promise.all([readFile(corpusPath, "utf8"), stat(corpusPath)]);
  } catch {
    // A missing corpus is a valid empty-state report, not a collection failure.
  }
  const stats = summarizeCorpusLines(contents.split(/\r?\n/), corpusPath, bytes, targetPosts, maxBytes);
  console.log(JSON.stringify(stats, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
