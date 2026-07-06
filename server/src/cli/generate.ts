import { generateUniqueMarketingPost } from "../generation/generator.js";
import { postStore } from "../storage/postStore.js";
import { runLogStore } from "../storage/runLogStore.js";

const existingPosts = await postStore.list();
const post = await generateUniqueMarketingPost(existingPosts, Number(process.argv[2] ?? existingPosts.length));
await postStore.createGenerated(post);
await runLogStore.append({
  action: "generate",
  status: "ok",
  message: `Generated post ${post.id}`,
  metadata: {
    postId: post.id,
    generator: post.generator,
    estimatedCostCny: post.estimatedCostCny
  }
});

console.log(JSON.stringify(post, null, 2));
