import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { planContentCalendar } from "../server/src/generation/contentCalendar.js";

interface Options {
  days: number;
  out?: string;
  format: "json" | "markdown";
}

function parseArgs(argv: string[]): Options {
  const options: Options = { days: 7, format: "markdown" };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--days") options.days = Number(argv[index + 1] ?? options.days);
    if (arg === "--out") options.out = argv[index + 1];
    if (arg === "--format") options.format = (argv[index + 1] as Options["format"]) ?? options.format;
  }

  if (!["json", "markdown"].includes(options.format)) {
    throw new Error("--format must be json or markdown");
  }

  return options;
}

function renderMarkdown(calendar: ReturnType<typeof planContentCalendar>) {
  const lines = ["# XHS Content Calendar", ""];

  for (const item of calendar) {
    lines.push(`## ${item.date} - Day ${item.slot}`);
    lines.push("");
    lines.push(`- Style: ${item.topic.style}`);
    lines.push(`- Segment: ${item.topic.targetSegment}`);
    lines.push(`- Scene: ${item.topic.scene}`);
    lines.push(`- Angle: ${item.topic.angle}`);
    lines.push(`- Hook: ${item.topic.hook}`);
    lines.push(`- Local signals: ${item.topic.localSignals.join(", ")}`);
    lines.push(`- Objective: ${item.objective}`);
    lines.push(`- Suggested format: ${item.suggestedFormat}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const options = parseArgs(process.argv.slice(2));
const calendar = planContentCalendar(options.days);
const output = options.format === "json" ? `${JSON.stringify(calendar, null, 2)}\n` : renderMarkdown(calendar);

if (options.out) {
  const outPath = resolve(options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, output, "utf8");
  console.log(outPath);
} else {
  console.log(output);
}
