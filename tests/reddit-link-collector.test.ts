import assert from "node:assert/strict";
import test from "node:test";
import { canonicalRedditPostUrl, filterAllowedSubredditLinks, onlyNewLinks, parseOptions, redditCollectionPlan, redditCollectionUrl, redditSubreddit } from "../scripts/collect-reddit-links.js";
import { isNtuRelatedContent, orderCollectionCandidates, parseByteLimit, parseOptions as parseContentOptions, redactPublicText } from "../scripts/collect-reddit-content.js";
import { summarizeCorpusLines } from "../scripts/reddit-corpus-stats.js";
import { classifyRedditTopics, parseLocalCorpusSignals } from "../client/src/redditTaxonomy.js";

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

test("onlyNewLinks skips history and preserves unique fresh URLs", () => {
  const known = new Set(["https://www.reddit.com/r/NTU/comments/known"]);
  assert.deepEqual(
    onlyNewLinks([
      "https://www.reddit.com/r/NTU/comments/known",
      "https://www.reddit.com/r/NTU/comments/fresh",
      "https://www.reddit.com/r/NTU/comments/fresh",
      "https://www.reddit.com/r/NTU/comments/another"
    ], known, 50),
    ["https://www.reddit.com/r/NTU/comments/fresh", "https://www.reddit.com/r/NTU/comments/another"]
  );
});

test("filters full-site search results to allowed communities", () => {
  const links = [
    "https://www.reddit.com/r/NTU/comments/ntupost",
    "https://www.reddit.com/r/SGExams/comments/sgpost",
    "https://www.reddit.com/r/GooseBumps/comments/noisepost"
  ];
  assert.equal(redditSubreddit(links[0]), "ntu");
  assert.deepEqual(
    filterAllowedSubredditLinks(links, new Set(["ntu", "sgexams"])),
    links.slice(0, 2)
  );
});

test("uses a direct new-post feed for r/NTU and restricted search elsewhere", () => {
  assert.equal(redditCollectionUrl("NTU", "ntu"), "https://www.reddit.com/r/NTU/new/?sort=new");
  assert.equal(
    redditCollectionUrl("NTU study tips", "sgexams"),
    "https://www.reddit.com/r/sgexams/search/?q=NTU+study+tips&restrict_sr=1&sort=new"
  );
});

test("keeps the direct NTU feed while adding topic searches across communities", () => {
  const plan = redditCollectionPlan("NTU", new Set(["ntu", "sgexams"]), ["course registration", "exchange"]);
  assert.deepEqual(plan, [
    { subreddit: "ntu", query: "NTU" },
    { subreddit: "ntu", query: "NTU course registration" },
    { subreddit: "ntu", query: "NTU exchange" },
    { subreddit: "sgexams", query: "NTU" },
    { subreddit: "sgexams", query: "NTU course registration" },
    { subreddit: "sgexams", query: "NTU exchange" }
  ]);
});

test("does not treat another option as a topic value", () => {
  const options = parseOptions(["--query", "NTU", "--topics", "--limit", "300"]);
  assert.deepEqual(options.topics, []);
  assert.equal(options.limit, 300);
});

test("supports an explicit no-topics flag", () => {
  const options = parseOptions(["--no-topics"]);
  assert.deepEqual(options.topics, []);
});

test("redacts direct contact and account identifiers from public discussion text", () => {
  assert.equal(
    redactPublicText("Email a@example.com or text +65 8123 4567. Ask u/example at https://example.com", 500),
    "Email [email removed] or text [phone removed]. Ask [user removed] at [link removed]"
  );
});

test("normalizes Unicode line separators before JSONL persistence", () => {
  assert.equal(redactPublicText("First\u2028Second\u2029Third", 500), "First\nSecond\nThird");
});

test("uses an ASCII ellipsis when redacting oversized public text", () => {
  assert.equal(redactPublicText("abcdefghij", 8), "abcde...");
});

test("parses the comment collector limits safely", () => {
  const options = parseContentOptions(["--limit", "30", "--request-delay-seconds", "5", "--target-posts", "99999", "--max-bytes", "1gb"]);
  assert.equal(options.batchLimit, 30);
  assert.equal(options.requestDelayMs, 5000);
  assert.equal(options.targetPosts, 10_000);
  assert.equal(options.maxBytes, 1024 ** 3);
  assert.equal(parseByteLimit("bad-value"), 1024 ** 3);
});

test("requires NTU context outside the direct NTU community", () => {
  assert.equal(isNtuRelatedContent("ntu", "Hall fridge procedures", "", []), true);
  assert.equal(isNtuRelatedContent("sgexams", "Hall fridge procedures", "", []), false);
  assert.equal(isNtuRelatedContent("sgexams", "Exchange options", "NTU students can apply.", []), true);
});

test("prioritizes fresh post URLs and defers repeated navigation failures", () => {
  const fresh = "https://www.reddit.com/r/NTU/comments/fresh";
  const retry = "https://www.reddit.com/r/NTU/comments/retry";
  const deferred = "https://www.reddit.com/r/NTU/comments/deferred";
  assert.deepEqual(
    orderCollectionCandidates(
      [retry, fresh, deferred],
      new Set<string>(),
      new Map([[retry, 1], [deferred, 3]])
    ),
    [fresh, retry]
  );
});

test("prioritizes direct NTU community posts among equally fresh candidates", () => {
  const communityPost = "https://www.reddit.com/r/SGExams/comments/community";
  const ntuPost = "https://www.reddit.com/r/NTU/comments/direct";
  assert.deepEqual(
    orderCollectionCandidates([communityPost, ntuPost], new Set<string>(), new Map()),
    [ntuPost, communityPost]
  );
});

test("reports corpus quality without emitting raw post or comment text", () => {
  const stats = summarizeCorpusLines([
    JSON.stringify({
      postUrl: "https://www.reddit.com/r/NTU/comments/example1",
      subreddit: "ntu",
      title: "Course registration help",
      body: "Use [link removed] for official details.",
      comments: ["Check the timetable."]
    }),
    JSON.stringify({
      postUrl: "https://www.reddit.com/r/Other/comments/example2",
      subreddit: "other",
      title: "Unrelated",
      body: "",
      comments: []
    }),
    "not-json"
  ], ".tmp/test-corpus.jsonl", 123);
  assert.equal(stats.validRecords, 2);
  assert.equal(stats.invalidLines, 1);
  assert.equal(stats.allowedSourceRecords, 1);
  assert.equal(stats.outsideWhitelistRecords, 1);
  assert.equal(stats.recordsWithPostBody, 1);
  assert.equal(stats.recordsWithComments, 1);
  assert.equal(stats.recordsWithRedactions, 1);
  assert.equal(stats.communities.ntu, 1);
  assert.equal(stats.communities.other, 1);
});

test("classifies local Reddit content without returning its raw text", () => {
  assert.ok(classifyRedditTopics("NTU hall swap and room rental advice").includes("宿舍与住宿"));
  const signals = parseLocalCorpusSignals(`${JSON.stringify({
    postUrl: "https://www.reddit.com/r/NTU/comments/example1",
    title: "Course registration help",
    body: "Need timetable and module advice",
    comments: ["Please share a private phone number"]
  })}\n`);
  assert.equal(signals.length, 1);
  assert.ok(signals[0].tags.includes("选课与学业安排"));
  assert.equal(signals[0].insight.includes("phone"), false);
});

test("adds a high-timeliness tag to operational student topics", () => {
  assert.ok(classifyRedditTopics("NTU add drop timetable and hall application").includes("高时效"));
});

test("classifies NBS career and work-pass discussions as timely job-seeking topics", () => {
  const tags = classifyRedditTopics("NBS career fair job search and employment pass questions");
  assert.ok(tags.includes("实习与求职"));
  assert.ok(tags.includes("高时效"));
});
