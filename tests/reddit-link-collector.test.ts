import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRedditPostUrl } from "../scripts/collect-reddit-links.js";

test("canonicalRedditPostUrl keeps only Reddit post URLs", () => {
  assert.equal(
    canonicalRedditPostUrl("/r/NTU/comments/abc123/example_post/?utm_source=share"),
    "https://www.reddit.com/r/NTU/comments/abc123"
  );
  assert.equal(
    canonicalRedditPostUrl("https://www.reddit.com/r/SGExams/comments/def456/example_post"),
    "https://www.reddit.com/r/SGExams/comments/def456"
  );
  assert.equal(canonicalRedditPostUrl("https://example.com/r/NTU/comments/abc123"), undefined);
  assert.equal(canonicalRedditPostUrl("https://www.reddit.com/r/NTU/"), undefined);
});
