export interface InspirationSignal {
  id: string;
  sourceType: "xiaohongshu" | "reddit";
  status?: "pending_review" | "approved";
  theme: string;
  audience: string;
  insight: string;
  tags?: string[];
  interactionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialBrief {
  cluster: "career" | "international" | "academic" | "housing" | "campus-life" | "general";
  audience: string;
  angle: string;
  format: "action-checklist" | "decision-guide" | "timeline" | "reassurance";
  actionSteps: string[];
  sourceBoundary: string;
}

/**
 * Community discussion is only a topic prompt, never factual evidence. Pick
 * a small, recent and coherent set instead of mixing unrelated student pain
 * points into one generic post.
 */
export function selectRedditInspirationSignals<T extends InspirationSignal>(
  signals: T[],
  random: () => number = Math.random,
  referenceTime = Date.now()
): T[] {
  const candidates = signals.filter((signal) =>
    signal.sourceType === "reddit"
    && signal.status === "approved"
    && signal.theme.trim()
    && signal.insight.trim().length >= 12
  );
  if (!candidates.length) return [];

  // A draft should synthesize a meaningful pattern, not borrow the shape of a
  // single discussion. Keep the set coherent, but use enough signals to make
  // the editorial angle less generic when the knowledge base is populated.
  const target = Math.min(candidates.length, 6 + Math.floor(random() * 4));
  const pool = [...candidates];
  const anchor = weightedPick(pool, random, referenceTime);
  const selected = [anchor];
  pool.splice(pool.findIndex((signal) => signal.id === anchor.id), 1);
  const primaryCluster = signalCluster(anchor);

  // Prefer one coherent student problem. A small amount of fallback variety is
  // allowed only when this cluster has too little material.
  while (pool.length && selected.length < target) {
    const clustered = pool.filter((signal) => signalCluster(signal) === primaryCluster);
    const source = clustered.length ? clustered : pool;
    const next = weightedPick(source, random, referenceTime);
    selected.push(next);
    pool.splice(pool.findIndex((signal) => signal.id === next.id), 1);
  }
  return selected;
}

export function buildEditorialBrief(signals: InspirationSignal[]): EditorialBrief {
  const anchor = signals[0];
  const cluster = anchor ? signalCluster(anchor) : "general";
  const audience = anchor?.audience.trim() || "NTU Chinese students";
  const blueprint = briefBlueprint(cluster);
  return {
    cluster,
    audience,
    ...blueprint,
    sourceBoundary: "Community signals only identify a question or pain point. Do not describe them as evidence, quote them, or turn them into a factual claim. Verify changing details against an official NTU or NBS source."
  };
}

export function draftSafetyNotes(body: string): string[] {
  const notes: string[] = [];
  const normalized = body.replace(/\s+/g, " ").trim();
  if (/\breddit\b|\br\/|网友说|网民说|帖子里说|论坛说|有人在.*?(?:说|提到)/i.test(normalized)) {
    notes.push("Do not cite, quote, or attribute a community discussion in the post.");
  }
  const actionMarkers = body.match(/(?:^|\n)\s*(?:[1-4][.、]|[-*•]|☐|✅|第一|第二|第三|第四)/gm) ?? [];
  if (actionMarkers.length < 3) {
    notes.push("Add at least three clearly separated, practical next steps before publishing.");
  }
  return notes;
}

function weightedPick<T extends InspirationSignal>(pool: T[], random: () => number, referenceTime: number): T {
  const weights = pool.map((signal) => freshnessWeight(signal.updatedAt || signal.createdAt, referenceTime) * engagementWeight(signal.interactionCount));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;
  let index = weights.length - 1;
  for (let position = 0; position < weights.length; position += 1) {
    cursor -= weights[position];
    if (cursor <= 0) {
      index = position;
      break;
    }
  }
  return pool[index];
}

function freshnessWeight(dateValue: string, referenceTime: number) {
  const ageDays = Math.max(0, (referenceTime - new Date(dateValue).getTime()) / 86_400_000);
  if (!Number.isFinite(ageDays) || ageDays > 30) return 1;
  if (ageDays <= 3) return 6;
  if (ageDays <= 7) return 5;
  return 3;
}

function engagementWeight(interactionCount?: number) {
  if (!interactionCount || interactionCount <= 0) return 1;
  return Math.min(2.5, 1 + Math.log10(interactionCount + 1) / 2);
}

function signalCluster(signal: InspirationSignal): EditorialBrief["cluster"] {
  const text = [signal.theme, signal.audience, signal.insight, ...(signal.tags ?? [])].join(" ").toLowerCase();
  if (/internship|career|job|resume|interview|graduate|employment|work pass|career fair|networking|求职|实习|就业/.test(text)) return "career";
  if (/exchange|international|visa|student pass|immigration|international student|交换|签证|留学生/.test(text)) return "international";
  if (/hall|hostel|accommodation|housing|room|rental|宿舍|住宿|租房/.test(text)) return "housing";
  if (/course|module|add[ .-]?drop|timetable|exam|gpa|academic|选课|课程|考试/.test(text)) return "academic";
  if (/orientation|matriculation|campus|cca|club|food|transport|freshman|新生|校园|社团/.test(text)) return "campus-life";
  return "general";
}

function briefBlueprint(cluster: EditorialBrief["cluster"]): Pick<EditorialBrief, "angle" | "format" | "actionSteps"> {
  switch (cluster) {
    case "career":
      return { angle: "Turn career anxiety into a short, verifiable preparation plan.", format: "action-checklist", actionSteps: ["Identify your current stage and one target role.", "Check the latest official school or employer requirements.", "Prepare one small application or networking action this week.", "Review what changed and set the next checkpoint."] };
    case "international":
      return { angle: "Turn an unfamiliar transition into a time-ordered checklist.", format: "timeline", actionSteps: ["Separate what must be confirmed now from what can wait.", "Find the current official page for eligibility and dates.", "Prepare documents or questions in one list.", "Leave buffer time and verify again before acting."] };
    case "housing":
      return { angle: "Help readers compare options without treating rumours as rules.", format: "decision-guide", actionSteps: ["Write down your non-negotiables and budget boundary.", "Check official accommodation information first.", "Compare two or three realistic options using the same criteria.", "Keep evidence and confirm the final arrangement in writing."] };
    case "academic":
      return { angle: "Make an academic question manageable with a concrete verification path.", format: "action-checklist", actionSteps: ["Clarify the module, term, and decision you are making.", "Check the latest official academic guidance.", "List constraints such as timetable or prerequisites.", "Ask a precise question through the appropriate official channel."] };
    case "campus-life":
      return { angle: "Give a newcomer a calm first-week action plan.", format: "reassurance", actionSteps: ["Choose one priority for this week.", "Locate the official page or support contact.", "Take one low-pressure action instead of trying everything at once.", "Review what helped and save it for the next newcomer."] };
    default:
      return { angle: "Turn a common student question into a practical next-step checklist.", format: "action-checklist", actionSteps: ["Name the decision you need to make.", "Separate facts from assumptions.", "Check the relevant official source.", "Choose one next action and a follow-up date."] };
  }
}
