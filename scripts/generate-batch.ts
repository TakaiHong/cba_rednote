import { generatePostBatch, planBatchGeneration } from "../server/src/generation/batch.js";
import { postStore } from "../server/src/storage/postStore.js";

interface Options {
  count: number;
  dryRun: boolean;
  maxModelPosts: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { count: 7, dryRun: false, maxModelPosts: 1 };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--count") options.count = Number(argv[index + 1] ?? options.count);
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--max-model-posts") options.maxModelPosts = Number(argv[index + 1] ?? options.maxModelPosts);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const existingPosts = await postStore.list();

if (options.dryRun) {
  console.log(JSON.stringify(planBatchGeneration(options), null, 2));
  process.exit(0);
}

const result = await generatePostBatch(existingPosts, options);
const saved = [];

for (const post of result.posts) {
  saved.push(await postStore.createGenerated(post));
}

console.log(
  JSON.stringify(
    {
      ...result.plan,
      created: saved.map((post) => ({
        id: post.id,
        title: post.title,
        status: post.status,
        generator: post.generator,
        estimatedCostCny: post.estimatedCostCny
      }))
    },
    null,
    2
  )
);
