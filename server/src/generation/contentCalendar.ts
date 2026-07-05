import { topicAgent } from "./agents.js";
import type { TopicPlan } from "../types.js";

export interface CalendarItem {
  date: string;
  slot: number;
  topic: TopicPlan;
  objective: string;
  suggestedFormat: string;
}

const objectives: Record<TopicPlan["style"], string> = {
  story: "用具体人物场景软植入迷你仓，降低广告感。",
  guide: "给出清晰步骤，吸引正在处理租房断档的人收藏。",
  pitfall: "提醒用户避开寄回国、低价卖掉或麻烦朋友的隐藏成本。",
  checklist: "提供可执行清单，适合发布前一天或周末收藏型内容。",
  comparison: "比较不同处理方式，突出便宜和灵活。",
  direct: "直接说明价格敏感人群可以自己运，赶时间可以帮运。",
  comment: "引导评论区描述物品清单和搬家难题，拉咨询。"
};

const formats: Record<TopicPlan["style"], string> = {
  story: "故事型图文，封面用真实房间或打包场景。",
  guide: "攻略型图文，正文用 3 到 5 步。",
  pitfall: "避坑型图文，封面突出一个反常识提醒。",
  checklist: "清单型图文，适合做可保存封面。",
  comparison: "对比型图文，适合做表格或四象限封面。",
  direct: "直白促销图文，适合配仓储空间和价格线索。",
  comment: "互动型图文，封面提问，正文留评论入口。"
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function planContentCalendar(days = 7, startDate = new Date()): CalendarItem[] {
  const safeDays = Math.max(1, Math.min(Math.floor(days), 30));
  const start = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));

  return Array.from({ length: safeDays }, (_, index) => {
    const plannedDate = new Date(start);
    plannedDate.setUTCDate(start.getUTCDate() + index);
    const topic = topicAgent(index);

    return {
      date: toDateString(plannedDate),
      slot: index + 1,
      topic,
      objective: objectives[topic.style],
      suggestedFormat: formats[topic.style]
    };
  });
}

export function renderCalendarMarkdown(calendar: CalendarItem[]) {
  const lines = ["# XHS Content Calendar", ""];

  for (const item of calendar) {
    lines.push(`## ${item.date} - Day ${item.slot}`);
    lines.push("");
    lines.push(`- Style: ${item.topic.style}`);
    lines.push(`- Segment: ${item.topic.targetSegment}`);
    lines.push(`- Scene: ${item.topic.scene}`);
    lines.push(`- Angle: ${item.topic.angle}`);
    lines.push(`- Hook: ${item.topic.hook}`);
    lines.push(`- Local signals: ${item.topic.localSignals.join(", ")}`);
    lines.push(`- Objective: ${item.objective}`);
    lines.push(`- Suggested format: ${item.suggestedFormat}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
