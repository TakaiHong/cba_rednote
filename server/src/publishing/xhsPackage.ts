import type { MarketingPost } from "../types.js";

export interface XhsPublishPackage {
  postId: string;
  title: string;
  body: string;
  tagsLine: string;
  imageIdeas: string[];
  coverText: string;
  visualBrief: string;
  imagePrompt: string;
  assetChecklist: string[];
  fullText: string;
}

export function createXhsPublishPackage(post: MarketingPost): XhsPublishPackage {
  const tagsLine = post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const parts = [post.body];
  if (post.callToAction) parts.push("", post.callToAction);
  if (tagsLine) parts.push("", tagsLine);
  const fullText = parts.join("\n");
  const coverText = post.title.length > 18 ? post.title.slice(0, 17) + "..." : post.title;
  const visualBrief = [
    `封面文字：${coverText}`,
    `场景：${post.topic.scene}`,
    `画面方向：${post.imageIdeas[0] ?? "真实行李和纸箱场景"}`,
    "构图：竖版 3:4，小红书封面，文字留白明显，主体是行李箱、纸箱或干净仓储空间。",
    "风格：真实、明亮、生活化，避免过度广告感。"
  ].join("\n");
  const imagePrompt = [
    "A realistic vertical lifestyle photo for Xiaohongshu, Singapore mini storage service,",
    `${post.topic.scene}, luggage boxes and compact furniture, clean storage room,`,
    "bright natural light, practical and trustworthy, no brand logo, leave clear space for Chinese cover text."
  ].join(" ");
  const assetChecklist = [
    "封面图 1 张：突出行李/纸箱/大件暂存场景",
    "细节图 1 张：纸箱标签、显示器、自行车或小家具",
    "空间图 1 张：干净迷你仓或整齐堆放效果",
    "发布前确认封面文字不挡主体"
  ];

  return {
    postId: post.id,
    title: post.title,
    body: post.body,
    tagsLine,
    imageIdeas: post.imageIdeas,
    coverText,
    visualBrief,
    imagePrompt,
    assetChecklist,
    fullText
  };
}

export function renderXhsMarkdownExport(pkg: XhsPublishPackage): string {
  return [
    `# ${pkg.title}`,
    "",
    `Post ID: ${pkg.postId}`,
    "",
    "## 发布正文",
    "",
    pkg.fullText,
    "",
    "## 标签",
    "",
    pkg.tagsLine,
    "",
    "## 图片建议",
    "",
    ...pkg.imageIdeas.map((idea) => `- ${idea}`),
    "",
    "## 封面文字",
    "",
    pkg.coverText,
    "",
    "## 图片 Brief",
    "",
    pkg.visualBrief,
    "",
    "## AI 出图 Prompt",
    "",
    pkg.imagePrompt,
    "",
    "## 素材清单",
    "",
    ...pkg.assetChecklist.map((item) => `- ${item}`),
    ""
  ].join("\n");
}
