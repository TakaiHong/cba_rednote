import { exportPerformanceReport } from "../server/src/analytics/exportPerformanceReport.js";

const outArgIndex = process.argv.findIndex((arg) => arg === "--out");
const outDir = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : "exports";

const result = await exportPerformanceReport(outDir);

console.log(result.outputPath);
