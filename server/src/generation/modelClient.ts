import { config } from "../config.js";
import type { GeneratedPost, MarketingPost, SourceReference, TopicPlan } from "../types.js";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function canUseModel() {
  return Boolean(config.openAiApiKey) && config.openAiModelCostCnyPerPostEstimate <= config.maxCostCnyPerPost;
}

function sourcePack(sources: SourceReference[]) {
  return sources.map((source) => ({
    id: source.id,
    publisher: source.publisher,
    title: source.title,
    url: source.url,
    claims: source.claims
  }));
}

function normalizeSourceIds(sourceIds: unknown, sources: SourceReference[]) {
  if (!Array.isArray(sourceIds)) return [];
  const allowed = new Set(sources.map((source) => source.id));
  return [...new Set(sourceIds.filter((id): id is string => typeof id === "string" && allowed.has(id)))];
}

export async function generateWithOpenAiCompatibleModel(
  topic: TopicPlan,
  sources: SourceReference[]
): Promise<GeneratedPost | undefined> {
  if (!canUseModel()) return undefined;

  const response = await fetch(`${config.openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是 NTU CBA 华商会的小红书内容运营。你必须严格遵守来源包：只能陈述来源包 claims 中明确出现的事实；不确定时只写主观体验、通用建议或提示读者查看官方链接。严禁编造或推断日期、时间、地点开放情况、选课规则、活动信息、服务资格、统计数据、费用和联系方式。每篇必须返回至少一个 sourceIds，且 sourceIds 只能来自来源包。标题必须不超过 20 个字符。只输出 JSON。"
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "生成一条小红书草稿",
            requiredShape: {
              title: "string",
              body: "string with paragraphs",
              tags: ["string"],
              imageIdeas: ["string"],
              callToAction: "string",
              sourceIds: ["source id used for factual statements"]
            },
            product:
              "NTU CBA 华商会官方账号。账号简介：想了解 NBS、对商科感兴趣、遇到学业或求职困扰，关注华商会；可通过私信加入 NBS 同学交流群。",
            topic,
            sourcePack: sourcePack(sources)
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return undefined;

  const parsed = JSON.parse(content) as Partial<GeneratedPost>;
  if (!parsed.title || !parsed.body || !Array.isArray(parsed.tags)) return undefined;

  const sourceIds = normalizeSourceIds(parsed.sourceIds, sources);
  if (sourceIds.length === 0) return undefined;

  return {
    title: parsed.title,
    body: parsed.body,
    tags: parsed.tags,
    imageIdeas: Array.isArray(parsed.imageIdeas) ? parsed.imageIdeas : [],
    callToAction: parsed.callToAction ?? "想看哪一类 NTU/NBS 内容，欢迎评论或私信告诉我们。",
    sourceIds
  };
}

export async function reviseWithOpenAiCompatibleModel(
  post: Pick<MarketingPost, "title" | "body" | "tags" | "imageIdeas" | "callToAction" | "topic">,
  feedback: string,
  sources: SourceReference[]
): Promise<GeneratedPost | undefined> {
  if (!canUseModel()) return undefined;

  const response = await fetch(`${config.openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.72,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是 NTU CBA 华商会的小红书内容运营。根据审核意见改写现有笔记，但只能陈述来源包 claims 中明确出现的事实。严禁编造或推断日期、时间、地点开放情况、选课规则、活动信息、服务资格、统计数据、费用和联系方式。每篇必须返回至少一个 sourceIds，且 sourceIds 只能来自来源包。标题必须不超过 20 个字符。只输出 JSON。"
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "按审核意见改写小红书笔记",
            feedback,
            requiredShape: {
              title: "string",
              body: "string with paragraphs",
              tags: ["string"],
              imageIdeas: ["string"],
              callToAction: "string",
              sourceIds: ["source id used for factual statements"]
            },
            currentPost: post,
            sourcePack: sourcePack(sources)
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return undefined;

  const parsed = JSON.parse(content) as Partial<GeneratedPost>;
  if (!parsed.title || !parsed.body || !Array.isArray(parsed.tags)) return undefined;

  const sourceIds = normalizeSourceIds(parsed.sourceIds, sources);
  if (sourceIds.length === 0) return undefined;

  return {
    title: parsed.title,
    body: parsed.body,
    tags: parsed.tags,
    imageIdeas: Array.isArray(parsed.imageIdeas) ? parsed.imageIdeas : [],
    callToAction: parsed.callToAction ?? post.callToAction,
    sourceIds
  };
}
