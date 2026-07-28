import { config } from "../config.js";
import type { GeneratedPost, TopicPlan } from "../types.js";

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

export async function generateWithOpenAiCompatibleModel(topic: TopicPlan): Promise<GeneratedPost | undefined> {
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
            "你是 NTU CBA 华商会的小红书内容运营。面向 NTU/NBS 中国留学生，写校园生活、学习资源、商科成长、求职讨论和社团活动。语言自然、实用、有同学聊天感，避免虚构官方规则、过度营销和夸张承诺。标题必须不超过 20 个字符。只输出 JSON。"
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
              callToAction: "string"
            },
            product:
              "NTU CBA 华商会官方账号。账号简介：想了解 NBS、对商科感兴趣、遇到学业或求职困扰，关注华商会；可通过私信加入 NBS 同学交流群。",
            topic
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

  return {
    title: parsed.title,
    body: parsed.body,
    tags: parsed.tags,
    imageIdeas: Array.isArray(parsed.imageIdeas) ? parsed.imageIdeas : [],
    callToAction: parsed.callToAction ?? "需要短租存放可以私信物品清单，我帮你估空间和价格。"
  };
}
