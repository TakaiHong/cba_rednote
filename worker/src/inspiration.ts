export interface InspirationSignal {
  id: string;
  sourceType: "xiaohongshu" | "reddit";
  status?: "pending_review" | "approved";
  theme: string;
  audience: string;
  insight: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Community discussion is only a topic prompt, never factual evidence. Keep
 * the set small and bias it toward recent, operator-approved Reddit signals.
 */
export function selectRedditInspirationSignals<T extends InspirationSignal>(
  signals: T[],
  random: () => number = Math.random,
  referenceTime = Date.now()
): T[] {
  const candidates = signals.filter((signal) =>
    signal.sourceType === "reddit"
    && signal.status === "approved"
    && signal.theme.trim()
    && signal.insight.trim().length >= 12
  );
  const target = Math.min(candidates.length, 3 + Math.floor(random() * 3));
  const pool = [...candidates];
  const selected: T[] = [];

  while (pool.length && selected.length < target) {
    const weights = pool.map((signal) => freshnessWeight(signal.updatedAt || signal.createdAt, referenceTime));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = random() * total;
    let index = weights.length - 1;
    for (let position = 0; position < weights.length; position += 1) {
      cursor -= weights[position];
      if (cursor <= 0) {
        index = position;
        break;
      }
    }
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

function freshnessWeight(dateValue: string, referenceTime: number) {
  const ageDays = Math.max(0, (referenceTime - new Date(dateValue).getTime()) / 86_400_000);
  if (!Number.isFinite(ageDays) || ageDays > 30) return 1;
  if (ageDays <= 7) return 5;
  return 3;
}
