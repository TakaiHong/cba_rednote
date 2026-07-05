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
            "你是小红书内容运营，负责新加坡迷你仓营销。语言自然、直白、多样，避免夸张承诺和硬广堆砌。只输出 JSON。"
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
              "新加坡便宜迷你仓，支持自己运和帮运，适合短期回国、租房断档、搬家延迟、大件存放。",
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
