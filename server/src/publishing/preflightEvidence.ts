import { readFile } from "node:fs/promises";

interface SelectorEvidence {
  selector: string;
  count: number;
  visible: boolean;
}

interface VisibleButtonDiagnostic {
  tag: string;
  text: string;
  ariaLabel: string;
  role: string;
  className: string;
  visible: boolean;
}

interface PreflightReport {
  postId?: string;
  generatedAt?: string;
  url?: string;
  selectors?: Partial<Record<"title" | "body" | "upload" | "publishButton", SelectorEvidence[]>>;
  diagnostics?: {
    visibleButtons?: VisibleButtonDiagnostic[];
  };
}

const requiredGroups = ["title", "body", "upload", "publishButton"] as const;
const maxPreflightAgeMs = 24 * 60 * 60 * 1000;

function reportAge(generatedAt?: string, now = Date.now()) {
  if (!generatedAt) return { ageMs: undefined, stale: true };
  const generatedTime = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTime)) return { ageMs: undefined, stale: true };
  const ageMs = Math.max(0, now - generatedTime);
  return { ageMs, stale: ageMs > maxPreflightAgeMs };
}

function selectorGroupHasVisibleHit(report: PreflightReport | undefined, group: (typeof requiredGroups)[number]) {
  if (group === "upload") {
    return Boolean(report?.selectors?.upload?.some((item) => item.count > 0));
  }
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
    const freshness = reportAge(report.generatedAt);
    const missingGroups = requiredGroups.filter((group) => !selectorGroupHasVisibleHit(report, group));
    const selectorsReady = missingGroups.length === 0;
    return {
      ok: selectorsReady && !freshness.stale,
      path,
      postId: report.postId,
      generatedAt: report.generatedAt,
      ageMs: freshness.ageMs,
      stale: freshness.stale,
      url: report.url,
      missingGroups,
      groups: buildGroupEvidence(report, missingGroups),
      diagnostics: {
        visibleButtons: report.diagnostics?.visibleButtons ?? []
      },
      detail:
        freshness.stale
          ? `Preflight report ${path} is stale or has no valid timestamp${missingGroups.length ? ` and is missing visible hits for: ${missingGroups.join(", ")}` : ""}. Run account preflight again.`
          : selectorsReady
          ? `Preflight report ${path} has visible selector hits for title, body, upload, and publishButton.`
          : `Preflight report ${path} is missing visible hits for: ${missingGroups.join(", ")}.`
    };
  } catch {
    return {
      ok: false,
      path,
      stale: true,
      missingGroups: [...requiredGroups],
      groups: buildGroupEvidence(undefined, requiredGroups),
      diagnostics: {
        visibleButtons: []
      },
      detail: `No usable preflight report found at ${path}. Run npm.cmd run publish:preflight in a real logged-in Xiaohongshu session.`
    };
  }
}

export type PreflightEvidenceResult = Awaited<ReturnType<typeof readPreflightEvidence>>;
