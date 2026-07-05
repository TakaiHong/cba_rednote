import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { planContentCalendar, renderCalendarMarkdown } from "../server/src/generation/contentCalendar.js";

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

const options = parseArgs(process.argv.slice(2));
const calendar = planContentCalendar(options.days);
const output = options.format === "json" ? `${JSON.stringify(calendar, null, 2)}\n` : renderCalendarMarkdown(calendar);

if (options.out) {
  const outPath = resolve(options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, output, "utf8");
  console.log(outPath);
} else {
  console.log(output);
}
