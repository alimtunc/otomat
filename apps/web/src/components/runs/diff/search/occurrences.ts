const SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Raw text, not a lowercased copy: `toLowerCase` can change length and shift every offset. */
export function occurrenceOffsets(haystack: string, needle: string): number[] {
  if (needle === "") return [];
  const scan = new RegExp(needle.replace(SPECIAL, "\\$&"), "gi");
  const offsets: number[] = [];
  for (let found = scan.exec(haystack); found !== null; found = scan.exec(haystack)) {
    offsets.push(found.index);
  }
  return offsets;
}
