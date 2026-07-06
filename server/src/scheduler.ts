import cron from "node-cron";
import { config } from "./config.js";
import { generateUniqueMarketingPost } from "./generation/generator.js";
import { postStore } from "./storage/postStore.js";
import { runLogStore } from "./storage/runLogStore.js";

export function startScheduler() {
  cron.schedule(config.dailyCron, async () => {
    try {
      const existingPosts = await postStore.list();
      const post = await generateUniqueMarketingPost(existingPosts, existingPosts.length);
      await postStore.createGenerated(post);
      await runLogStore.append({
        action: "scheduler-generate",
        status: "ok",
        message: `Scheduled generation created post ${post.id}`,
        metadata: {
          postId: post.id,
          generator: post.generator,
          estimatedCostCny: post.estimatedCostCny
        }
      });
      console.log(`[scheduler] generated post ${post.id} at ${new Date().toISOString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      await runLogStore.append({
        action: "scheduler-generate",
        status: "error",
        message,
        metadata: { dailyCron: config.dailyCron }
      });
      console.error(`[scheduler] generation failed: ${message}`);
    }
  });
  console.log(`[scheduler] daily generation scheduled: ${config.dailyCron}`);
}
