import type { ContentStyle, GeneratedPost, ReviewResult, TargetSegment, TopicPlan } from "../types.js";

const styles: ContentStyle[] = ["story", "guide", "pitfall", "checklist", "comparison", "direct", "comment"];
const segments: TargetSegment[] = ["student_returning_china", "worker_returning_china", "lease_gap", "large_items", "renovation", "general"];

const scenes: Record<TargetSegment, string[]> = {
  student_returning_china: ["刚到 NTU 的新生，第一周发现课表、校园卡和选课全挤在一起", "交换生想在离开前把 NTU 的遗憾清单补完"],
  worker_returning_china: ["毕业前在新加坡找实习，才发现简历和 networking 根本不能临时抱佛脚", "刚入职的学长回学校分享，聊到了第一份工作的真实落差"],
  lease_gap: ["Recess Week 到了，宿舍和自习室都像被按下暂停键", "考试周前两天，才发现预约自习位比想象中更难"],
  large_items: ["NBS 小组作业赶在截止前，大家第一次把分工讲清楚", "社团活动前一晚，筹备组还在为现场流程做最后一次对表"],
  renovation: ["新学期开始，想把学习节奏从混乱拉回正轨", "期中结束后，开始认真想一想商科学生到底该怎么准备求职"],
  general: ["第一次在 NTU 上课，发现校园比地图上看起来大得多", "一个普通周末，几个 NBS 同学聊到了留学里那些没人提前说的事"]
};

const angles = ["把校园信息讲成同学会转发的实用提醒", "从一个具体困扰出发，给出可执行的下一步", "用真实同学视角聊商科与求职", "把活动信息写得有参与感，而不是公告", "用一个问题带动评论区经验交换", "把校园资源拆成一张能收藏的清单"];
const localSignals = ["NTU", "NBS", "North Spine", "The Hive", "LWN Library", "Recess Week", "BDE", "STARS", "CareerAxis", "Singapore"];

function pick<T>(items: T[], seed: number) {
  const safeSeed = Number.isFinite(seed) ? Math.floor(seed) : 0;
  return items[Math.abs(safeSeed) % items.length];
}

function daySeed() {
  return [...new Date().toISOString().slice(0, 10)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function topicAgent(offset = 0): TopicPlan {
  const seed = daySeed() + offset;
  const targetSegment = pick(segments, seed);
  const scene = pick(scenes[targetSegment], seed + 4);
  return {
    style: pick(styles, seed + 2),
    targetSegment,
    scene,
    angle: pick(angles, seed + 6),
    hook: scene.split("，")[0],
    localSignals: [pick(localSignals, seed), pick(localSignals, seed + 3), pick(localSignals, seed + 7)]
  };
}

const titles: Record<ContentStyle, string[]> = {
  story: ["在 NTU 的第一周，我差点被这些小事劝退", "一个 NBS 学长的求职弯路，早点知道会轻松很多"],
  guide: ["NTU 新生第一周，先把这 5 件事搞定", "NBS 小组作业不内耗：我们这样分工"],
  pitfall: ["NTU 选课前别急，这几个坑真的会踩到", "商科求职别只改简历，很多人卡在这一步"],
  checklist: ["NTU 考试周前的收藏清单", "NBS 新生开学前，一页准备清单"],
  comparison: ["NTU 自习室怎么选？安静、组会、赶 ddl 分开说", "商科社团活动要不要去？用 3 个问题判断"],
  direct: ["NTU CBA 本周活动来了：想认识商科同学的看这里", "NBS 同学想找实习搭子？这次活动适合你"],
  comment: ["NTUer：你最想有人早点告诉你的校园小事是什么？", "NBS 同学，最近最让你头大的问题是哪一个？"]
};

export function copyAgent(topic: TopicPlan): GeneratedPost {
  const title = pick(titles[topic.style], topic.hook.length + topic.localSignals.length);
  const body = buildBody(topic);
  return {
    title,
    body,
    tags: buildTags(topic),
    imageIdeas: ["便利贴风格封面：一个大问题 + 3 个短答案，使用 NTU 红、深蓝和米白", "信息卡图：校园地点或活动时间做成清晰时间线", "同学聊天感的文字卡：一句真实困扰加一条可执行建议"],
    callToAction: "想看哪一类 NTU/NBS 内容，或者想加入 NBS 同学交流群，评论或私信告诉我们。"
  };
}

function buildBody(topic: TopicPlan) {
  const opening = `${topic.scene}。`;
  const shared = "华商会想把这些容易踩坑、但又很少有人系统讲清楚的事整理出来，给正在 NTU 生活和学习的同学一点实际帮助。";
  if (topic.style === "checklist" || topic.style === "guide") {
    return [opening, "先收藏这份轻量版清单：", "1. 先确认官方信息和截止时间，不靠群聊二手消息。", "2. 把地点、材料和下一步拆开写，避免临时手忙脚乱。", "3. 有不确定的地方，就去问已经做过的学长学姐。", "4. 事情很多时，优先处理会影响选课、考试或申请的那一件。", shared, "你还想看哪一个校园流程的攻略？"].join("\n\n");
  }
  if (topic.style === "comparison") {
    return [opening, "这类选择没有唯一标准，但可以先看三件事：你现在最缺什么、投入时间值不值、能不能认识到一起做事的人。", "想安静赶进度，就选资源和环境；想解决信息差，就找做过的人聊；想扩大圈子，就去参加能真正交流的活动。", shared, "你会怎么选？评论区说说你的经验。"].join("\n\n");
  }
  if (topic.style === "comment") {
    return [opening, "留学生活里最难的往往不是一件大事，而是很多小问题同时出现：课业、求职、社交、生活节奏。", shared, "把你现在最想解决的一个问题留在评论区，大家互相补充答案。"].join("\n\n");
  }
  if (topic.style === "direct") {
    return [opening, "这不是一条硬邦邦的活动通知。我们更想做一个让 NBS 和 NTU 华人同学能认识彼此、交换经验的场域。", "无论你在找学习搭子、求职信息，还是只是刚到新加坡想认识一些新朋友，都可以来聊聊。", "活动时间、地点和报名方式会在图里同步更新。", "欢迎私信我们加入 NBS 同学交流群。"].join("\n\n");
  }
  return [opening, "当时最真实的感受不是忙，而是不知道该先问谁、先做什么。", "后来才发现，很多问题并不需要一个人硬扛：去找靠谱的同学问一句，或者把步骤先写下来，事情就会清楚很多。", shared, "如果你也遇到过类似时刻，欢迎把经验留给后来的同学。"].join("\n\n");
}

function buildTags(topic: TopicPlan) {
  return [...new Set(["NTU", "南洋理工大学", "新加坡留学", "NBS", "NTU华商会", ...topic.localSignals])].slice(0, 9);
}

export function reviewAgent(post: GeneratedPost): ReviewResult {
  const notes: string[] = [];
  let score = 90;
  if (post.title.length > 20) {
    score -= 15;
    notes.push("Title exceeds Xiaohongshu's 20-character limit.");
  }
  if (post.body.length < 120) {
    score -= 10;
    notes.push("Body could use more useful detail.");
  }
  if (post.tags.length < 5) {
    score -= 5;
    notes.push("Add more searchable tags.");
  }
  if (notes.length === 0) notes.push("Natural, campus-first draft ready for human review.");
  return { score, notes, approved: score >= 75 };
}
