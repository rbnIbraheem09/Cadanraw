/** Human-friendly relative time from a SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS"). */
export function formatRelativeTime(sqliteUtc: string): string {
  const ts = Date.parse(sqliteUtc.replace(" ", "T") + "Z"); // treat as UTC
  if (Number.isNaN(ts)) return "";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "1 element" / "3 elements". */
export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
