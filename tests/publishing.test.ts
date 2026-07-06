import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePublishedUrl } from "../server/src/publishing/publishedUrl.js";
import { createXhsPublishPackage, renderXhsMarkdownExport } from "../server/src/publishing/xhsPackage.js";
import type { MarketingPost } from "../server/src/types.js";

function fromCodePoints(values: number[]) {
  return values.map((codePoint) => String.fromCodePoint(codePoint)).join("");
}

const mojibakePattern = new RegExp(
  [
    [0x93c2, 0x677f],
    [0x9354, 0x72b2],
    [0x704f, 0x5fd5],
    [0x6769, 0x612f],
    [0x7efe, 0xe76d],
    [0x6d93, 0x20ac]
  ]
    .map(fromCodePoints)
    .join("|") + "|\\uFFFD"
);

function postFixture(): MarketingPost {
  return {
    id: "post-1",
    title: "新加坡租房断档，东西可以这样先过渡",
    body: "旧房到期，新房还没好。\n\n行李和小家具可以先短租存放，不用急着丢。",
    tags: ["新加坡生活", "#迷你仓", "租房断档"],
    imageIdeas: ["行李箱和纸箱放进干净迷你仓"],
    callToAction: "私信物品清单，帮你估算需要多大空间。",
    status: "approved",
    topic: {
      style: "guide",
      targetSegment: "lease_gap",
      scene: "新加坡租房断档，需要短期存放行李和小家具",
      angle: "用迷你仓做搬家缓冲",
      hook: "旧房到期，新房还没好",
      localSignals: ["MRT", "Condo"]
    },
    review: { score: 88, notes: ["ok"], approved: true },
    metrics: { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 },
    estimatedCostCny: 0,
    generator: "local-template",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z"
  };
}

describe("createXhsPublishPackage", () => {
  it("formats title, body, call to action, and normalized tags", () => {
    const pkg = createXhsPublishPackage(postFixture());

    assert.equal(pkg.postId, "post-1");
    assert.equal(pkg.title, "新加坡租房断档，东西可以这样先过渡");
    assert.equal(pkg.tagsLine, "#新加坡生活 #迷你仓 #租房断档");
    assert.equal(pkg.coverText, "新加坡租房断档，东西可以这样先过渡");
    assert.ok(pkg.visualBrief.includes("封面文字"));
    assert.ok(pkg.visualBrief.includes("构图：竖版 3:4"));
    assert.ok(pkg.imagePrompt.includes("Singapore mini storage"));
    assert.equal(pkg.assetChecklist.length >= 3, true);
    assert.ok(pkg.fullText.includes("旧房到期"));
    assert.ok(pkg.fullText.includes("私信物品清单"));
    assert.ok(pkg.fullText.endsWith("#新加坡生活 #迷你仓 #租房断档"));
  });

  it("renders a readable Markdown handoff package", () => {
    const markdown = renderXhsMarkdownExport(createXhsPublishPackage(postFixture()));

    assert.ok(markdown.includes("# 新加坡租房断档，东西可以这样先过渡"));
    assert.ok(markdown.includes("## 发布正文"));
    assert.ok(markdown.includes("## 图片 Brief"));
    assert.ok(markdown.includes("## 素材清单"));
    assert.doesNotMatch(markdown, mojibakePattern);
  });
});

describe("normalizePublishedUrl", () => {
  it("accepts http and https URLs for published evidence", () => {
    assert.equal(
      normalizePublishedUrl(" https://www.xiaohongshu.com/explore/example "),
      "https://www.xiaohongshu.com/explore/example"
    );
    assert.equal(normalizePublishedUrl("http://example.com/note").startsWith("http://"), true);
  });

  it("rejects missing or non-http URLs", () => {
    assert.equal(normalizePublishedUrl(undefined), undefined);
    assert.equal(normalizePublishedUrl(""), undefined);
    assert.equal(normalizePublishedUrl("not a url"), undefined);
    assert.equal(normalizePublishedUrl("file:///tmp/note"), undefined);
  });
});
