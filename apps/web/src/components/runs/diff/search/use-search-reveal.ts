import { scrollIntoContainer } from "@web/components/runs/diff/scroll";
import { clearDiffSearch, paintDiffSearch } from "@web/components/runs/diff/search/highlight";
import type { DiffSearchMatch } from "@web/components/runs/diff/search/matches";
import type { DiffSearch } from "@web/components/runs/diff/search/use-diff-search";
import { useEffect, useLayoutEffect, useRef } from "react";

function matchKey(cursor: number, match: DiffSearchMatch): string {
  return `${cursor} ${match.path} ${match.oldLine} ${match.newLine} ${match.occurrence}`;
}

export function useSearchReveal(search: DiffSearch, onShowFile: (path: string) => void): void {
  const shown = useRef<string | null>(null);
  const scrolled = useRef<string | null>(null);

  // otomat-allow-effect: painting and scrolling read the DOM React has just committed, and
  // resolving no row schedules no render, so the retry has to ride every later one.
  useLayoutEffect(() => {
    const element = paintDiffSearch(search.query, search.matches, search.activeIndex);
    const match = search.matches[search.activeIndex];
    if (match === undefined) {
      shown.current = null;
      scrolled.current = null;
      return;
    }
    const key = matchKey(search.cursor, match);
    if (shown.current !== key) {
      shown.current = key;
      onShowFile(match.path);
    }
    if (element === null || scrolled.current === key) return;
    scrollIntoContainer(element, "center");
    scrolled.current = key;
  });

  // otomat-allow-effect: the painted names are global, so leaving the diff has to drop them.
  useEffect(() => () => clearDiffSearch(), []);
}
