import { readFile } from "node:fs/promises";

interface SelectorEvidence {
  selector: string;
  count: number;
  visible: boolean;
}

interface PreflightReport {
  generatedAt?: string;
  url?: string;
  selectors?: Partial<Record<"title" | "body" | "upload" | "publishButton", SelectorEvidence[]>>;
}

const requiredGroups = ["title", "body", "upload", "publishButton"] as const;

function selectorGroupHasVisibleHit(report: PreflightReport | undefined, group: (typeof requiredGroups)[number]) {
  return Boolean(report?.selectors?.[group]?.some((item) => item.count > 0 && item.visible));
}

function buildGroupEvidence(report: PreflightReport | undefined, missingGroups: ReadonlyArray<(typeof requiredGroups)[number]>) {
  return {
    title: {
      ok: !missingGroups.includes("title"),
      selectors: report?.selectors?.title ?? []
    },
    body: {
      ok: !missingGroups.includes("body"),
      selectors: report?.selectors?.body ?? []
    },
    upload: {
      ok: !missingGroups.includes("upload"),
      selectors: report?.selectors?.upload ?? []
    },
    publishButton: {
      ok: !missingGroups.includes("publishButton"),
      selectors: report?.selectors?.publishButton ?? []
    }
  };
}

export async function readPreflightEvidence(path = process.env.XHS_PREFLIGHT_REPORT ?? ".tmp/xhs-preflight-report.json") {
  try {
    const report = JSON.parse(await readFile(path, "utf8")) as PreflightReport;
    const missingGroups = requiredGroups.filter((group) => !selectorGroupHasVisibleHit(report, group));
    return {
      ok: missingGroups.length === 0,
      path,
      generatedAt: report.generatedAt,
      url: report.url,
      missingGroups,
      groups: buildGroupEvidence(report, missingGroups),
      detail:
        missingGroups.length === 0
          ? `Preflight report ${path} has visible selector hits for title, body, upload, and publishButton.`
          : `Preflight report ${path} is missing visible hits for: ${missingGroups.join(", ")}.`
    };
  } catch {
    return {
      ok: false,
      path,
      missingGroups: [...requiredGroups],
      groups: buildGroupEvidence(undefined, requiredGroups),
      detail: `No usable preflight report found at ${path}. Run npm.cmd run publish:preflight in a real logged-in Xiaohongshu session.`
    };
  }
}

export type PreflightEvidenceResult = Awaited<ReturnType<typeof readPreflightEvidence>>;
