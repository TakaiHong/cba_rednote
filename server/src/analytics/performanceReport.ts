import { summarizeContentStrategy } from "./contentStrategy.js";
import type { MarketingPost } from "../types.js";

function interactions(post: MarketingPost) {
  return post.metrics.likes + post.metrics.saves + post.metrics.comments + post.metrics.follows;
}

function rate(numerator: number, denominator: number) {
  return denominator ? `${((numerator / denominator) * 100).toFixed(2)}%` : "0.00%";
}

function renderPostRow(post: MarketingPost) {
  const totalInteractions = interactions(post);
  return [
    post.title.replace(/\|/g, "/"),
    post.status,
    String(post.metrics.views),
    String(totalInteractions),
    String(post.metrics.inquiries),
    rate(totalInteractions, post.metrics.views),
    rate(post.metrics.inquiries, post.metrics.views),
    post.publishedUrl ?? ""
  ].join(" | ");
}

export function renderPerformanceReport(posts: MarketingPost[], generatedAt = new Date()) {
  const strategy = summarizeContentStrategy(posts);
  const measuredPosts = posts.filter((post) => post.metrics.views > 0);
  const publishedPosts = posts.filter((post) => post.status === "published");
  const totals = measuredPosts.reduce(
    (sum, post) => {
      sum.views += post.metrics.views;
      sum.interactions += interactions(post);
      sum.inquiries += post.metrics.inquiries;
      return sum;
    },
    { views: 0, interactions: 0, inquiries: 0 }
  );
  const rankedPosts = [...measuredPosts].sort((a, b) => {
    if (b.metrics.inquiries !== a.metrics.inquiries) return b.metrics.inquiries - a.metrics.inquiries;
    return interactions(b) - interactions(a);
  });

  return [
    "# Xiaohongshu Performance Report",
    "",
    `Generated at: ${generatedAt.toISOString()}`,
    "",
    "## Snapshot",
    "",
    `- Total posts: ${posts.length}`,
    `- Published posts: ${publishedPosts.length}`,
    `- Posts with metrics: ${measuredPosts.length}`,
    `- Total views: ${totals.views}`,
    `- Total interactions: ${totals.interactions}`,
    `- Total inquiries: ${totals.inquiries}`,
    `- Interaction rate: ${rate(totals.interactions, totals.views)}`,
    `- Inquiry rate: ${rate(totals.inquiries, totals.views)}`,
    "",
    "## Recommendation",
    "",
    strategy.recommendation,
    "",
    "## Metric Backfill Checklist",
    "",
    "- After every publish, record the Xiaohongshu note URL.",
    "- After 24 hours, record views, likes, saves, comments, follows, and inquiries.",
    "- After 72 hours, update the same metrics once more before judging content quality.",
    "- Treat inquiries as the primary signal for the next topic; use saves as the secondary signal for guide/checklist content.",
    "",
    "## Measured Posts",
    "",
    measuredPosts.length
      ? "| Title | Status | Views | Interactions | Inquiries | Interaction Rate | Inquiry Rate | URL |"
      : "No posts have metrics yet. Publish one reviewed note, then backfill metrics here.",
    measuredPosts.length ? "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |" : "",
    ...rankedPosts.map(renderPostRow),
    "",
    "## Best Buckets",
    "",
    `- Best style: ${strategy.bestStyle?.key ?? "not enough data"}`,
    `- Best segment: ${strategy.bestSegment?.key ?? "not enough data"}`,
    ""
  ].join("\n");
}
