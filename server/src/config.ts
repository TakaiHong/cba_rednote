import "dotenv/config";
import { resolveModelSettings } from "./modelConfig.js";

const modelSettings = resolveModelSettings(process.env);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dailyCron: process.env.DAILY_CRON ?? "15 9 * * *",
  modelProvider: modelSettings.provider,
  openAiApiKey: modelSettings.apiKey,
  openAiBaseUrl: modelSettings.baseUrl,
  openAiModel: modelSettings.model,
  openAiModelCostCnyPerPostEstimate: modelSettings.estimatedCostCnyPerPost,
  maxCostCnyPerPost: Number(process.env.MAX_COST_CNY_PER_POST ?? 0.5),
  xhsCreatorUrl:
    process.env.XHS_CREATOR_URL ?? "https://creator.xiaohongshu.com/publish/publish?target=image&from=codex"
};
