import type { GeneratedPost } from "../types.js";

const unsupportedFactPatterns: Array<[RegExp, string]> = [
  [/(?:\bSTARS\b|\bBDE\b|\bThe Hive\b|\bNorth Spine\b|\bLWN Library\b|\bCareerAxis\b)/i, "未获来源支持的校内系统或地点"],
  [/(?:\d{1,2}\s*(?:am|pm|:|点|时)|\d{1,2}\s*[月\/\-]\s*\d{1,2}\s*[日号]?|\d{4}\s*[年\/\-])/i, "未获来源支持的日期或时间"],
  [/(?:报名方式|报名截止|截止日期|活动时间|开放时间|选课规则|课程代码|费用|名额)/, "未获来源支持的运营细节"]
];

export function findUnsupportedFactSignals(post: Pick<GeneratedPost, "title" | "body">) {
  const text = `${post.title}\n${post.body}`;
  return unsupportedFactPatterns.flatMap(([pattern, label]) => (pattern.test(text) ? [label] : []));
}
