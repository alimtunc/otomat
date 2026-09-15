import type { WorktreeFileEntry } from "@otomat/domain";

function scorePath(path: string, query: string): number {
  const lower = path.toLowerCase();
  const name = lower.slice(lower.lastIndexOf("/") + 1);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (lower.includes(query)) return 3;
  let cursor = 0;
  for (const character of query) {
    const found = lower.indexOf(character, cursor);
    if (found < 0) return Infinity;
    cursor = found + 1;
  }
  return 4 + cursor / Math.max(path.length, 1);
}

export function searchFiles(
  entries: readonly WorktreeFileEntry[],
  query: string,
): WorktreeFileEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return entries.slice(0, 80);
  return entries
    .map((entry) => ({ entry, score: scorePath(entry.path, needle) }))
    .filter(({ score }) => Number.isFinite(score))
    .toSorted((a, b) => a.score - b.score || a.entry.path.localeCompare(b.entry.path))
    .slice(0, 80)
    .map(({ entry }) => entry);
}
