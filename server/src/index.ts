import cors from "cors";
import express from "express";
import { config } from "./config.js";
import postsRouter from "./routes/posts.js";
import { startScheduler } from "./scheduler.js";
import { getSystemStatus } from "./status.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "xhs-mini-storage-platform" });
});

app.get("/api/status", async (_req, res) => {
  res.json(await getSystemStatus());
});

app.use("/api/posts", postsRouter);

app.listen(config.port, () => {
  console.log(`[server] listening on http://127.0.0.1:${config.port}`);
  startScheduler();
});
