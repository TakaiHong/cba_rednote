export interface ModelSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "deepseek" | "openai-compatible" | "local-template";
  estimatedCostCnyPerPost: number;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

function toCost(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveModelSettings(env: NodeJS.ProcessEnv): ModelSettings {
  const explicitOpenAiKey = firstNonEmpty(env.OPENAI_API_KEY);
  const deepSeekKey = firstNonEmpty(env.DEEPSEEK_API_KEY);
  const apiKey = firstNonEmpty(explicitOpenAiKey, deepSeekKey) ?? "";
  const usingDeepSeekAlias = !explicitOpenAiKey && Boolean(deepSeekKey);
  const provider = usingDeepSeekAlias ? "deepseek" : apiKey ? "openai-compatible" : "local-template";

  return {
    apiKey,
    baseUrl: firstNonEmpty(env.OPENAI_BASE_URL, usingDeepSeekAlias ? "https://api.deepseek.com" : undefined) ?? "https://api.openai.com/v1",
    model:
      firstNonEmpty(
        env.OPENAI_MODEL,
        usingDeepSeekAlias ? env.DEEPSEEK_MODEL : undefined,
        usingDeepSeekAlias ? "deepseek-v4-flash" : undefined
      ) ?? "gpt-4.1-mini",
    provider,
    estimatedCostCnyPerPost: toCost(
      firstNonEmpty(env.MODEL_COST_CNY_PER_POST_ESTIMATE, env.OPENAI_MODEL_COST_CNY_PER_POST_ESTIMATE),
      0.12
    )
  };
}
