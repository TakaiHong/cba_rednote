import "dotenv/config";
import { resolveModelSettings } from "./modelConfig.js";

const modelSettings = resolveModelSettings(process.env);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  isProduction: process.env.NODE_ENV === "production",
  cloudRuntime: process.env.CLOUD_RUNTIME === "true",
  persistenceProvider: process.env.PERSISTENCE_PROVIDER ?? "local",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "",
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
  assetStorageProvider: process.env.ASSET_STORAGE_PROVIDER ?? "local",
  cloudSchedulerToken: process.env.CLOUD_SCHEDULER_TOKEN ?? "",
  dashboardUsername: process.env.DASHBOARD_USERNAME ?? "operator",
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? "",
  dailyCron: process.env.DAILY_CRON ?? "15 9 * * *",
  modelProvider: modelSettings.provider,
  openAiApiKey: modelSettings.apiKey,
  openAiBaseUrl: modelSettings.baseUrl,
  openAiModel: modelSettings.model,
  openAiModelCostCnyPerPostEstimate: modelSettings.estimatedCostCnyPerPost,
  maxCostCnyPerPost: Number(process.env.MAX_COST_CNY_PER_POST ?? 0.5),
  xhsCreatorUrl:
    process.env.XHS_CREATOR_URL ?? "https://creator.xiaohongshu.com/publish/publish?target=image&from=codex",
  brandName: "NTU CBA 华商会",
  brandShortName: "NTU CBA"
};
