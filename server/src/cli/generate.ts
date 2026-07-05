import { generateMarketingPost } from "../generation/generator.js";
import { postStore } from "../storage/postStore.js";

const post = await generateMarketingPost(Number(process.argv[2] ?? 0));
await postStore.createGenerated(post);

console.log(JSON.stringify(post, null, 2));
