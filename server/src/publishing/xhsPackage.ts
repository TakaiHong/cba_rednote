import type { MarketingPost } from "../types.js";

export interface XhsPublishPackage {
  postId: string;
  title: string;
  body: string;
  tagsLine: string;
  imageIdeas: string[];
  imageAssets: string[];
  coverText: string;
  visualBrief: string;
  imagePrompt: string;
  assetChecklist: string[];
  fullText: string;
}

const xhsTitleMaxLength = 20;

function fitTitle(value: string, maxLength: number) {
  return Array.from(value.trim()).slice(0, maxLength).join("");
}

export function normalizeXhsTitle(title: string, maxLength = xhsTitleMaxLength) {
  const trimmed = title.trim();
  if (Array.from(trimmed).length <= maxLength) return trimmed;

  const [head, ...tailParts] = trimmed.split(/[|｜]/).map((part) => part.trim()).filter(Boolean);
  const tail = tailParts.join(" ");
  if (head && tail) {
    const keywords = [
      ...(tail.includes("家具") ? ["家具暂存"] : []),
      ...(tail.includes("行李") ? ["行李暂存"] : []),
      ...(tail.includes("迷你仓") ? ["迷你仓"] : []),
      ...(tail.includes("搬") ? ["搬家"] : []),
      ...(tail.includes("回国") ? ["回国"] : []),
      ...(tail.includes("租房") ? ["租房"] : [])
    ];
    const candidate = [head, ...keywords].join("");
    if (Array.from(candidate).length <= maxLength && candidate.length > head.length) return candidate;
    if (Array.from(head).length <= maxLength) return head;
  }

  return fitTitle(trimmed, maxLength).replace(/[，。；、|｜\s]+$/, "");
}

export function createXhsPublishPackage(post: MarketingPost): XhsPublishPackage {
  const title = normalizeXhsTitle(post.title);
  const tagsLine = post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const parts = [post.body];
  if (post.callToAction) parts.push("", post.callToAction);
  if (tagsLine) parts.push("", tagsLine);

  const fullText = parts.join("\n");
  const coverText = title;
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
    title,
    body: post.body,
    tagsLine,
    imageIdeas: post.imageIdeas,
    imageAssets: post.imageAssets ?? [],
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
    "## 图片素材",
    "",
    ...(pkg.imageAssets.length > 0 ? pkg.imageAssets.map((asset) => `- ${asset}`) : ["暂无已绑定图片素材"]),
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
