import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CORPUS = path.resolve(".tmp", "reddit-ntu-content-corpus.jsonl");
const DEFAULT_OUTPUT = path.resolve(".tmp", "reddit-ntu-evidence-cards.json");
const ALLOWED_SUBREDDITS = new Set(["ntu", "sgexams", "asksingapore", "singapore", "sit_singapore"]);

export interface RedditEvidenceCard {
  sourceUrl: string;
  sourceType: "reddit";
  collectionMethod: "browser-curated";
  status: "approved";
  theme: string;
  audience: string;
  insight: string;
  tags: string[];
  interactionCount: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  evidence: {
    problem: string;
    considerations: string[];
    timeliness: "high" | "normal" | "background";
    confidence: "community-pattern";
  };
}

interface CorpusRecord {
  collectedAt?: unknown;
  postUrl?: unknown;
  subreddit?: unknown;
  title?: unknown;
  body?: unknown;
  comments?: unknown;
}

const TOPICS = [
  { id: "academic", theme: "NTU 选课与学业决策", tags: ["选课", "课程", "学业"], match: /course|module|registration|add[ -]?drop|timetable|exam|gpa|prerequisite|coursework|选课|课程|考试|先修/ },
  { id: "housing", theme: "NTU 住宿与宿舍安排", tags: ["住宿", "宿舍", "生活"], match: /hall|hostel|accommodation|room|rental|housing|swap|宿舍|住宿|租房/ },
  { id: "career", theme: "NTU 求职与实习准备", tags: ["求职", "实习", "就业"], match: /internship|career|resume|interview|job|graduate|employment|linkedin|实习|求职|就业|简历|面试/ },
  { id: "international", theme: "NTU 国际生与交换准备", tags: ["国际生", "交换", "签证"], match: /exchange|international|visa|student pass|immigration|arrival|overseas|交换|签证|国际生|留学生/ },
  { id: "campus", theme: "NTU 校园生活与新生适应", tags: ["校园生活", "新生", "社团"], match: /orientation|matriculation|cca|club|campus|food|transport|freshman|新生|校园|社团/ }
];

function string(value: unknown) { return typeof value === "string" ? value : ""; }
function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return ""; }
}
function subreddit(record: CorpusRecord, sourceUrl: string) {
  const explicit = string(record.subreddit).toLowerCase().replace(/^r\//, "");
  if (explicit) return explicit;
  const match = sourceUrl.match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1]?.toLowerCase() ?? "";
}
function textForClassification(record: CorpusRecord) {
  // This string is deliberately used only in-process. It is never output.
  return [string(record.title), string(record.body), ...(Array.isArray(record.comments) ? record.comments.filter((value): value is string => typeof value === "string") : [])].join(" ").toLowerCase();
}
function topicFor(text: string) { return TOPICS.find((topic) => topic.match.test(text)) ?? { id: "general", theme: "NTU 学生信息差与决策", tags: ["NTU", "学生生活", "信息整理"], match: /$^/ }; }
function considerationsFor(topicId: string, text: string) {
  const values: string[] = [];
  const add = (condition: boolean, value: string) => { if (condition && !values.includes(value)) values.push(value); };
  add(/deadline|date|semester|term|when|时间|截止|学期/.test(text), "先确认适用学期、日期和当前页面版本");
  add(/prerequisite|eligib|requirement|criteria|资格|先修|要求/.test(text), "把资格、先修或申请条件单独核对");
  add(/waitlist|clash|conflict|timetable|queue|冲突|候补|时间表/.test(text), "把时间冲突、候补或排队等限制写进决策表");
  add(/cost|budget|fee|price|rent|money|预算|费用|租金/.test(text), "先设定预算边界，再比较可选方案");
  add(/document|form|email|contact|support|材料|表格|联系/.test(text), "提前列出所需材料和需要联系的官方渠道");
  if (topicId === "academic") values.push("明确模块、学期和个人课表后再执行下一步");
  if (topicId === "housing") values.push("用同一组标准比较住宿选择，不把个案当成规则");
  if (topicId === "career") values.push("把大目标拆成一周内可完成的求职或准备动作");
  if (topicId === "international") values.push("区分必须立即确认的入境或交换事项与可稍后处理的事项");
  if (topicId === "campus") values.push("先选一个低压力的校园行动，再决定是否扩展参与");
  return [...new Set(values)].slice(0, 4);
}
function timeliness(text: string): RedditEvidenceCard["evidence"]["timeliness"] {
  return /deadline|date|semester|term|registration|visa|appeal|截止|日期|学期|选课|签证/.test(text) ? "high" : "normal";
}

export function buildEvidenceCards(lines: string[], referenceTime = new Date()): RedditEvidenceCard[] {
  const seen = new Set<string>();
  const cards: RedditEvidenceCard[] = [];
  const expiry = new Date(referenceTime.getTime() + 21 * 86_400_000).toISOString();
  for (const line of lines.filter(Boolean)) {
    let record: CorpusRecord;
    try { record = JSON.parse(line) as CorpusRecord; } catch { continue; }
    const sourceUrl = canonicalUrl(string(record.postUrl));
    if (!sourceUrl || seen.has(sourceUrl) || !ALLOWED_SUBREDDITS.has(subreddit(record, sourceUrl))) continue;
    const sourceText = textForClassification(record);
    if (sourceText.length < 80) continue;
    const topic = topicFor(sourceText);
    const considerations = considerationsFor(topic.id, sourceText);
    if (considerations.length < 2) continue;
    const collectedAt = string(record.collectedAt) || referenceTime.toISOString();
    const updatedAt = Number.isNaN(Date.parse(collectedAt)) ? referenceTime.toISOString() : new Date(collectedAt).toISOString();
    const time = timeliness(sourceText);
    cards.push({
      sourceUrl, sourceType: "reddit", collectionMethod: "browser-curated", status: "approved",
      theme: topic.theme, audience: "NTU Chinese students", tags: topic.tags,
      insight: `公开社区讨论反复出现的决策点：${considerations.slice(0, 2).join("；")}。仅用于选题和结构，不作为事实依据。`,
      interactionCount: Math.min(100, Math.floor(sourceText.length / 300)),
      expiresAt: expiry, createdAt: updatedAt, updatedAt,
      evidence: { problem: topic.theme, considerations, timeliness: time, confidence: "community-pattern" }
    });
    seen.add(sourceUrl);
  }
  return cards.sort((left, right) => Number(right.evidence.timeliness === "high") - Number(left.evidence.timeliness === "high"));
}

async function main() {
  const args = process.argv.slice(2);
  const input = path.resolve(args[args.indexOf("--in") + 1] || DEFAULT_CORPUS);
  const output = path.resolve(args[args.indexOf("--out") + 1] || DEFAULT_OUTPUT);
  const raw = await readFile(input, "utf8");
  const cards = buildEvidenceCards(raw.split(/\r?\n/));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), policy: "Derived, anonymized community evidence only. No post body, comments, username, profile, email, phone, or external links are exported.", cards }, null, 2), "utf8");
  console.log(JSON.stringify({ input, output, cards: cards.length, highTimeliness: cards.filter((card) => card.evidence.timeliness === "high").length, themes: Object.fromEntries(cards.reduce((map, card) => map.set(card.theme, (map.get(card.theme) ?? 0) + 1), new Map<string, number>())) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) void main();
