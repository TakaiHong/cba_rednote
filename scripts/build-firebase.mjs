import { resolve } from "node:path";
import { build, loadEnv } from "vite";

const root = resolve("client");

// Production settings live with the client and must be loaded before Vite
// replaces import.meta.env values in the static bundle.
Object.assign(process.env, loadEnv("production", root, ""));

await build({
  root,
  build: {
    outDir: resolve("dist"),
    emptyOutDir: true
  }
});
