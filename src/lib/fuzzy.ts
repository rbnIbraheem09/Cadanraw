/**
 * Subsequence match with bonuses for prefixes, word starts and runs.
 * Returns 0 when `query` isn't a subsequence of `text`; higher is better.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - t.length;
  const at = t.indexOf(q);
  if (at >= 0) return (isWordStart(t, at) ? 600 : 400) - at - t.length * 0.1;

  let score = 0;
  let from = 0;
  let run = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const i = t.indexOf(ch, from);
    if (i < 0) return 0;
    run = i === from ? run + 1 : 0;
    score += 10 + run * 6 + (isWordStart(t, i) ? 14 : 0) - Math.min(i - from, 8);
    from = i + 1;
  }
  return Math.max(1, score - t.length * 0.1);
}

function isWordStart(text: string, i: number) {
  return i === 0 || /[\s\-_/·.]/.test(text[i - 1]);
}

/** Rank `items` by how well `text(item)` matches; drops non-matches. */
export function fuzzyFilter<T>(query: string, items: readonly T[], text: (item: T) => string): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item) => ({ item, score: fuzzyScore(query, text(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
