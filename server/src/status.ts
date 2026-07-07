import { summarizeContentStrategy } from "./analytics/contentStrategy.js";
import { config } from "./config.js";
import { postStore } from "./storage/postStore.js";
import { runLogStore } from "./storage/runLogStore.js";

export async function getSystemStatus() {
  const posts = await postStore.list();
  const recentRuns = await runLogStore.list(5);
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
  const totalEstimatedCostCny = Number(posts.reduce((sum, post) => sum + post.estimatedCostCny, 0).toFixed(4));
  const averageEstimatedCostCny = posts.length ? Number((totalEstimatedCostCny / posts.length).toFixed(4)) : 0;
  const paidModelPosts = posts.filter((post) => post.generator === "openai-compatible").length;

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
    cost: {
      totalEstimatedCostCny,
      averageEstimatedCostCny,
      paidModelPosts,
      withinPerPostBudget: posts.every((post) => post.estimatedCostCny <= config.maxCostCnyPerPost)
    },
    recentRuns,
    strategy,
    commands: {
      generate: "npm.cmd run generate",
      generateBatch: "npm.cmd run generate:batch -- --count 7 --max-model-posts 1",
      calendar: "npm.cmd run calendar -- --days 7",
      export: "npm.cmd run export -- --post latest",
      imageBrief: "npm.cmd run image:brief -- --post latest --out .tmp/image-assets",
      handoff: "npm.cmd run handoff -- --out .tmp/handoff",
      publishDryRun: "npm.cmd run publish -- --post latest --dry-run",
      publishPreflight: "npm.cmd run publish:preflight",
      backup: "npm.cmd run backup",
      scheduleInstall: "npm.cmd run schedule:install",
      verify: "npm.cmd run verify"
    }
  };
}
