import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduler } from "./scheduler.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`[server] listening on http://127.0.0.1:${config.port}`);
  startScheduler();
});
