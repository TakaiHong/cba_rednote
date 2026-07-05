import cron from "node-cron";
import { config } from "./config.js";
import { generateMarketingPost } from "./generation/generator.js";
import { postStore } from "./storage/postStore.js";

export function startScheduler() {
  cron.schedule(config.dailyCron, async () => {
    const post = await generateMarketingPost();
    await postStore.createGenerated(post);
    console.log(`[scheduler] generated post ${post.id} at ${new Date().toISOString()}`);
  });
  console.log(`[scheduler] daily generation scheduled: ${config.dailyCron}`);
}
