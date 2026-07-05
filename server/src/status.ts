import { summarizeContentStrategy } from "./analytics/contentStrategy.js";
import { config } from "./config.js";
import { postStore } from "./storage/postStore.js";

export async function getSystemStatus() {
  const posts = await postStore.list();
  const counts = posts.reduce(
    (acc, post) => {
      acc.total += 1;
      acc[post.status] += 1;
      return acc;
    },
    { total: 0, draft: 0, approved: 0, published: 0, archived: 0 }
  );
  const latest = posts[0];
  const strategy = summarizeContentStrategy(posts);

  return {
    service: "xhs-mini-storage-platform",
    ok: true,
    generatedAt: new Date().toISOString(),
    counts,
    latestPost: latest
      ? {
          id: latest.id,
          title: latest.title,
          status: latest.status,
          createdAt: latest.createdAt,
          generator: latest.generator,
          estimatedCostCny: latest.estimatedCostCny
        }
      : undefined,
    config: {
      dailyCron: config.dailyCron,
      maxCostCnyPerPost: config.maxCostCnyPerPost,
      modelProvider: config.modelProvider,
      modelConfigured: Boolean(config.openAiApiKey),
      model: config.openAiModel,
      xhsCreatorUrl: config.xhsCreatorUrl
    },
    strategy,
    commands: {
      generate: "npm.cmd run generate",
      export: "npm.cmd run export -- --post latest",
      publishDryRun: "npm.cmd run publish -- --post latest --dry-run",
      publishPreflight: "npm.cmd run publish:preflight",
      scheduleInstall: "npm.cmd run schedule:install",
      verify: "npm.cmd run verify"
    }
  };
}
