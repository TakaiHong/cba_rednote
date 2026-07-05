import { generateUniqueMarketingPost } from "../generation/generator.js";
import { postStore } from "../storage/postStore.js";

const existingPosts = await postStore.list();
const post = await generateUniqueMarketingPost(existingPosts, Number(process.argv[2] ?? existingPosts.length));
await postStore.createGenerated(post);

console.log(JSON.stringify(post, null, 2));
