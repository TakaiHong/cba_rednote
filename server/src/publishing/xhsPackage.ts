import type { MarketingPost } from "../types.js";

export interface XhsPublishPackage {
  postId: string;
  title: string;
  body: string;
  tagsLine: string;
  imageIdeas: string[];
  fullText: string;
}

export function createXhsPublishPackage(post: MarketingPost): XhsPublishPackage {
  const tagsLine = post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const parts = [post.body];
  if (post.callToAction) parts.push("", post.callToAction);
  if (tagsLine) parts.push("", tagsLine);
  const fullText = parts.join("\n");

  return {
    postId: post.id,
    title: post.title,
    body: post.body,
    tagsLine,
    imageIdeas: post.imageIdeas,
    fullText
  };
}
