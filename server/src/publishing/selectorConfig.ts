import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const selectorConfigSchema = z.object({
  title: z.array(z.string()).min(1),
  body: z.array(z.string()).min(1),
  publishButton: z.array(z.string()).default([]),
  upload: z.array(z.string()).default([])
});

export type XhsSelectorConfig = z.infer<typeof selectorConfigSchema>;

export async function loadXhsSelectorConfig(path = "config/xhs-selectors.json"): Promise<XhsSelectorConfig> {
  const raw = await readFile(join(process.cwd(), path), "utf8");
  return selectorConfigSchema.parse(JSON.parse(raw));
}
