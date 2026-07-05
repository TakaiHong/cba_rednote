import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const supportedImageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface ImageInputOptions {
  imagePaths: string[];
  imagesDir?: string;
}

export async function resolveImageInputs(options: ImageInputOptions) {
  const files = [...options.imagePaths];

  if (options.imagesDir) {
    const entries = await readdir(options.imagesDir, { withFileTypes: true });
    const dirFiles = entries
      .filter((entry) => entry.isFile() && supportedImageExts.has(extname(entry.name).toLowerCase()))
      .map((entry) => join(options.imagesDir!, entry.name))
      .sort((a, b) => a.localeCompare(b));
    files.push(...dirFiles);
  }

  return [...new Set(files.map((file) => resolve(file)))];
}
