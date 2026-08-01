export interface LocalRedditSignalInput {
  sourceUrl: string;
  theme: string;
  audience: string;
  insight: string;
  tags: string[];
}

interface LocalCorpusRow {
  postUrl?: unknown;
  title?: unknown;
  body?: unknown;
  comments?: unknown;
}

const topicRules: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "宿舍与住宿", pattern: /\b(hall|hostel|accommodation|housing|roommate|room swap|rental|rent|dorm)\b|宿舍|住宿/i },
  { tag: "选课与学业安排", pattern: /\b(course registration|module|add.drop|add drop|timetable|class|exam|gpa|academic)\b|选课|课程|考试/i },
  { tag: "新生入学与校园融入", pattern: /\b(freshman|freshie|orientation|matriculation|admission|appeal|offer)\b|新生|入学/i },
  { tag: "交换与国际学生", pattern: /\b(exchange|international student|visa|student pass|immigration)\b|交换|留学生|签证/i },
  { tag: "实习与求职", pattern: /\b(internship|career|job|resume|interview|graduate programme)\b|实习|求职|招聘/i },
  { tag: "费用与生活服务", pattern: /\b(cost|budget|fee|concession|canteen|food|laundry|paynow)\b|费用|生活|食堂/i },
  { tag: "校园交通与设施", pattern: /\b(bus|mrt|transport|library|facility|campus|card)\b|交通|图书馆|设施/i },
  { tag: "社团与人际", pattern: /\b(cca|club|society|friend|social|community)\b|社团|朋友|社交/i }
];

export function classifyRedditTopics(text: string) {
  const tags = topicRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.tag);
  return tags.length ? tags.slice(0, 3) : ["其他 NTU 学生讨论"];
}

export function parseLocalCorpusSignals(content: string, limit = 400): LocalRedditSignalInput[] {
  const signals: LocalRedditSignalInput[] = [];
  const seen = new Set<string>();

  for (const line of content.split("\n")) {
    if (signals.length >= limit) break;
    let row: LocalCorpusRow;
    try {
      row = JSON.parse(line) as LocalCorpusRow;
    } catch {
      continue;
    }
    const sourceUrl = typeof row.postUrl === "string" ? row.postUrl.trim() : "";
    if (!/^https:\/\/www\.reddit\.com\/r\/[^/]+\/comments\//i.test(sourceUrl) || seen.has(sourceUrl)) continue;
    const comments = Array.isArray(row.comments) ? row.comments.filter((value): value is string => typeof value === "string") : [];
    const text = [row.title, row.body, ...comments].filter((value): value is string => typeof value === "string").join("\n");
    const tags = classifyRedditTopics(text);
    const theme = tags[0];
    signals.push({
      sourceUrl,
      theme,
      audience: tags.includes("交换与国际学生") ? "新生、交换生与国际学生" : "NTU 在读学生与准新生",
      insight: `将「${theme}」作为学生信息差选题线索；具体流程、日期和资格须另用 NTU 官方来源核验。`,
      tags
    });
    seen.add(sourceUrl);
  }
  return signals;
}
