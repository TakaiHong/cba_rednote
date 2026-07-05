import type { ContentStyle, GeneratedPost, ReviewResult, TargetSegment, TopicPlan } from "../types.js";

const styles: ContentStyle[] = ["story", "guide", "pitfall", "checklist", "comparison", "direct", "comment"];
const segments: TargetSegment[] = [
  "student_returning_china",
  "worker_returning_china",
  "lease_gap",
  "large_items",
  "renovation",
  "general"
];

const segmentScenes: Record<TargetSegment, string[]> = {
  student_returning_china: [
    "NUS 学生暑假回国三个月，宿舍要退，两个行李箱和一台显示器没地方放",
    "NTU 毕业搬离 hall，家具不值得寄回国但也舍不得丢",
    "SIM 学生临时回国，朋友家已经堆满了箱子"
  ],
  worker_returning_china: [
    "上班族临时回国一个月，租约刚好到期",
    "项目结束要换区住，东西先找地方过渡",
    "出差时间拉长，房间退了但大件物品还在新加坡"
  ],
  lease_gap: [
    "旧房周五交房，新房下周三才能入住",
    "Clementi 看房没定下来，房东又催着搬走",
    "合租室友变动，家具需要先放两周"
  ],
  large_items: [
    "床垫、桌椅、自行车和显示器不想卖亏",
    "搬家时最难处理的是大件，不是衣服",
    "家里空间太小，季节用品和箱子越堆越多"
  ],
  renovation: [
    "Condo 装修两个月，家具需要临时挪走",
    "房间刷漆和换地板，怕东西落灰受潮",
    "短租期间不想把全部家具来回搬"
  ],
  general: [
    "新加坡租房节奏太快，东西需要一个缓冲区",
    "MRT 附近搬家不难，难的是东西暂时放哪里",
    "寄回国、低价卖掉、麻烦朋友，不一定比短租仓省"
  ]
};

const angles = [
  "短租断档的缓冲方案",
  "回国前最后一周的行李处理",
  "大件物品不必低价处理",
  "自己运省钱，帮运省心",
  "把搬家的混乱拆成可控步骤",
  "用真实故事软植入迷你仓"
];

const localSignals = ["HDB", "Condo", "MRT", "Clementi", "Jurong", "Tampines", "NUS", "NTU", "SMU", "SIM"];

function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function daySeed() {
  const today = new Date().toISOString().slice(0, 10);
  return [...today].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function topicAgent(offset = 0): TopicPlan {
  const seed = daySeed() + offset;
  const targetSegment = pick(segments, seed);
  const style = pick(styles, seed + 2);
  const scene = pick(segmentScenes[targetSegment], seed + 4);
  return {
    style,
    targetSegment,
    scene,
    angle: pick(angles, seed + 6),
    hook: scene.split("，")[0],
    localSignals: [pick(localSignals, seed), pick(localSignals, seed + 3), pick(localSignals, seed + 7)]
  };
}

export function copyAgent(topic: TopicPlan): GeneratedPost {
  const tags = buildTags(topic);
  const title = buildTitle(topic);
  const body = buildBody(topic);

  return {
    title,
    body,
    tags,
    imageIdeas: [
      "行李箱、纸箱和显示器摆在房间门口的真实照片",
      "仓储空间干净整齐的近景，突出箱子和大件可放",
      "搬家前后对比图：房间混乱到物品入仓"
    ],
    callToAction: "需要新加坡短租存放的话，可以私信发你的物品清单，我帮你估一个更省钱的方案。"
  };
}

function buildTitle(topic: TopicPlan) {
  const titleByStyle: Record<ContentStyle, string> = {
    story: "回国前 3 天，我才发现行李真的没地方放",
    guide: "新加坡租房断档，东西可以这样先过渡",
    pitfall: "别急着把东西寄回国，可能更贵也更麻烦",
    checklist: "回国前 7 天，行李和大件处理清单",
    comparison: "朋友家、寄回国、低价卖、迷你仓怎么选",
    direct: "新加坡便宜迷你仓：自己运/帮运都可以",
    comment: "在新加坡搬家，最头疼的是不是东西没处放？"
  };
  return titleByStyle[topic.style];
}

function buildBody(topic: TopicPlan) {
  if (topic.style === "story") {
    return [
      `${topic.scene}。`,
      "这种情况在新加坡真的很常见：房子到期、机票已买、朋友家也不好意思一直借放。",
      "如果只是短期过渡，其实不用急着低价卖掉，也不一定要花大钱寄回国。",
      "迷你仓更适合这种尴尬时间差：箱子、小家具、显示器、自行车都能先放着。",
      "预算敏感可以自己运，东西多或者赶时间可以选帮运。重点是先把东西安顿好，人回国也安心一点。"
    ].join("\n\n");
  }

  if (topic.style === "checklist") {
    return [
      "回国前一周可以按这个顺序处理：",
      "1. 先把必须带回国的证件、电脑、衣物分出来。",
      "2. 再看哪些东西值得留：显示器、床品、小家具、厨房用品。",
      "3. 不急着用但舍不得丢的，集中打包贴标签。",
      "4. 算一下寄回国、低价卖掉、短租仓三个成本。",
      "5. 如果只是放几周到几个月，迷你仓通常更灵活。",
      "自己运会更省，帮运适合箱子多或有大件的人。"
    ].join("\n\n");
  }

  if (topic.style === "guide") {
    return [
      `${topic.scene}，这种过渡期最容易让人崩溃。`,
      "可以先按三个问题判断：你多久后回来、东西有没有大件、寄回国会不会比存放更贵。",
      "如果只是几周到几个月，短租迷你仓会比临时麻烦朋友更稳定，也不用为了赶交房低价卖东西。",
      "少量箱子可以自己运，预算会更低；有床垫、桌椅、显示器或自行车，就更适合选帮运。",
      "建议打包时把证件和电脑先分开，其他箱子贴上标签。等新房确定后，再一次性取回会轻松很多。",
      "这类情况在 NUS、NTU、Clementi、Jurong 一带搬家时很常见，重点不是存多久，而是先给自己一个缓冲。"
    ].join("\n\n");
  }

  if (topic.style === "comparison") {
    return [
      "新加坡搬家断档时，常见选择其实就几个：",
      "放朋友家：便宜，但欠人情，也不适合大件。",
      "寄回国：适合真的不回新加坡的人，但短期回国可能不划算。",
      "低价卖掉：最快，但回来再买一遍也心疼。",
      "迷你仓：适合还会回来、东西不想丢、租期只差一段时间的人。",
      "我们主打便宜和灵活，能自己运就自己运，想省事也可以安排帮运。"
    ].join("\n\n");
  }

  if (topic.style === "pitfall") {
    return [
      "很多人回国前第一反应是：要不全部寄回国吧。",
      "但如果你几个月后还会回新加坡，运费、时间、损耗加起来可能并不划算。",
      `${topic.scene}，这种情况更适合先找一个短期存放点。`,
      "东西不用卖亏，不用麻烦朋友，也不用把房间交接拖到最后一天。",
      "迷你仓可以按物品量选空间，自己运更便宜，帮运更省心。"
    ].join("\n\n");
  }

  if (topic.style === "comment") {
    return [
      "你在新加坡搬家时最崩溃的瞬间是什么？",
      "我听过最多的不是找不到车，而是旧房要退、新房没好，东西突然变成一个大问题。",
      `${topic.scene}。`,
      "这种时候其实可以先把箱子和大件放进迷你仓，等新房确定了再慢慢搬。",
      "预算紧就自己运，东西多就选帮运。欢迎评论区说说你的情况，我可以帮你判断哪种更省。"
    ].join("\n\n");
  }

  return [
    `${topic.scene}。`,
    "如果你现在也遇到租约断档、短期回国、搬家延迟或大件没地方放，可以考虑短租迷你仓。",
    "我们主打便宜和灵活：少量物品可以自己运，东西多或没时间可以选帮运。",
    "适合行李箱、纸箱、显示器、自行车、小家具、季节用品等临时存放。",
    "把物品清单发来，可以先估空间和价格，再决定要不要存。"
  ].join("\n\n");
}

function buildTags(topic: TopicPlan) {
  const base = ["新加坡生活", "新加坡租房", "新加坡搬家", "迷你仓", "行李寄存"];
  const segmentTags: Record<TargetSegment, string[]> = {
    student_returning_china: ["留学生回国", "NUS", "NTU"],
    worker_returning_china: ["新加坡上班族", "短期回国", "搬家过渡"],
    lease_gap: ["租房断档", "退租", "临时存放"],
    large_items: ["大件存放", "家具存放", "显示器"],
    renovation: ["装修收纳", "家具暂存", "Condo"],
    general: ["HDB", "MRT", "省钱搬家"]
  };
  return [...new Set([...base, ...segmentTags[topic.targetSegment], ...topic.localSignals])].slice(0, 10);
}

export function reviewAgent(post: GeneratedPost): ReviewResult {
  const notes: string[] = [];
  let score = 90;

  if (post.body.length < 180) {
    score -= 10;
    notes.push("Body could use more detail.");
  }
  if ((post.body.match(/迷你仓/g) ?? []).length > 4) {
    score -= 8;
    notes.push("Brand/category term appears too often.");
  }
  if (post.tags.length < 5) {
    score -= 5;
    notes.push("Add more searchable tags.");
  }
  if (notes.length === 0) notes.push("Natural enough for a first draft.");

  return { score, notes, approved: score >= 75 };
}
