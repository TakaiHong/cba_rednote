import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dailyCron: process.env.DAILY_CRON ?? "15 9 * * *",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openAiModelCostCnyPerPostEstimate: Number(process.env.OPENAI_MODEL_COST_CNY_PER_POST_ESTIMATE ?? 0.12),
  maxCostCnyPerPost: Number(process.env.MAX_COST_CNY_PER_POST ?? 0.5),
  xhsCreatorUrl: process.env.XHS_CREATOR_URL ?? "https://creator.xiaohongshu.com/"
};
