import cron from "node-cron";
import { config } from "./config.js";
import { generateUniqueMarketingPost } from "./generation/generator.js";
import { postStore } from "./storage/postStore.js";

export function startScheduler() {
  cron.schedule(config.dailyCron, async () => {
    const existingPosts = await postStore.list();
    const post = await generateUniqueMarketingPost(existingPosts, existingPosts.length);
    await postStore.createGenerated(post);
    console.log(`[scheduler] generated post ${post.id} at ${new Date().toISOString()}`);
  });
  console.log(`[scheduler] daily generation scheduled: ${config.dailyCron}`);
}
