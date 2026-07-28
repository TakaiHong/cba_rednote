import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduler } from "./scheduler.js";

const app = createApp();

if (config.isProduction && !config.dashboardPassword) {
  throw new Error("DASHBOARD_PASSWORD must be configured before running in production.");
}

app.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`);
  startScheduler();
});
