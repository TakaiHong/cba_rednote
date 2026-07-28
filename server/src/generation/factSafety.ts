import type { GeneratedPost, SourceReference } from "../types.js";

const unsupportedFactPatterns: Array<[RegExp, string, string[]]> = [
  [/(?:\bSTARS\b|\bBDE\b|\bThe Hive\b|\bNorth Spine\b)/i, "未获来源支持的校内系统或地点", []],
  [/\bLWN Library\b/i, "未获来源支持的校内系统或地点", ["ntu-library-spaces"]],
  [/\bCareerAxis\b/i, "未获来源支持的校内系统或地点", ["ntu-career-services"]],
  [/(?:\d{1,2}\s*(?:am|pm|:|点|时)|\d{1,2}\s*[月\/\-]\s*\d{1,2}\s*[日号]?|\d{4}\s*[年\/\-])/i, "未获来源支持的日期或时间", []],
  [/(?:报名方式|报名截止|截止日期|活动时间|开放时间|选课规则|课程代码|费用|名额)/, "未获来源支持的运营细节", []]
];

export function findUnsupportedFactSignals(post: Pick<GeneratedPost, "title" | "body">, sources: SourceReference[] = []) {
  const text = `${post.title}\n${post.body}`;
  const sourceIds = new Set(sources.map((source) => source.id));
  return unsupportedFactPatterns.flatMap(([pattern, label, allowedSourceIds]) =>
    pattern.test(text) && !allowedSourceIds.some((sourceId) => sourceIds.has(sourceId)) ? [label] : []
  );
}
