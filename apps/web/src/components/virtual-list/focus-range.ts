import { defaultRangeExtractor, type Range } from "@tanstack/react-virtual";

export function focusRange(range: Range, focused: number | null): number[] {
  const indices = defaultRangeExtractor(range);
  if (focused === null) return indices;
  return [...new Set([...indices, focused - 1, focused, focused + 1])]
    .filter((index) => index >= 0 && index < range.count)
    .toSorted((a, b) => a - b);
}
