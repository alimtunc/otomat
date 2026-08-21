import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import type { DiffSearchMatch } from "@web/components/runs/diff/search/matches";
import { occurrenceRanges } from "@web/components/runs/diff/search/ranges";
import { lineTextElements } from "@web/components/runs/diff/search/rows";

/** Must match the `::highlight()` rules in `review-diff.css`. */
const ALL_MATCHES = "otomat-diff-search";
const ACTIVE_MATCH = "otomat-diff-search-active";

interface LineHit {
  position: number;
  occurrence: number;
}

interface LineGroup {
  path: string;
  oldLine: number | null;
  newLine: number | null;
  hits: LineHit[];
}

function groupByLine(matches: readonly DiffSearchMatch[]): LineGroup[] {
  const groups = new Map<string, LineGroup>();
  matches.forEach((match, position) => {
    const key = `${match.path} ${match.oldLine} ${match.newLine}`;
    const group = groups.get(key) ?? {
      path: match.path,
      oldLine: match.oldLine,
      newLine: match.newLine,
      hits: [],
    };
    group.hits.push({ position, occurrence: match.occurrence });
    groups.set(key, group);
  });
  return [...groups.values()];
}

function paint(name: string, ranges: readonly Range[]): void {
  if (typeof Highlight === "undefined") return;
  if (ranges.length === 0) {
    CSS.highlights.delete(name);
    return;
  }
  const highlight = new Highlight();
  for (const range of ranges) highlight.add(range);
  CSS.highlights.set(name, highlight);
}

/** Ranges decorate without touching the DOM, which @git-diff-view owns and rebuilds. */
export function paintDiffSearch(
  query: string,
  matches: readonly DiffSearchMatch[],
  activeIndex: number,
): HTMLElement | null {
  const all: Range[] = [];
  const active: Range[] = [];
  let activeElement: HTMLElement | null = null;

  for (const group of groupByLine(matches)) {
    const card = document.getElementById(diffFileDomId(group));
    if (card === null) continue;
    for (const element of lineTextElements(card, group)) {
      const ranges = occurrenceRanges(element, query);
      for (const hit of group.hits) {
        const range = ranges[hit.occurrence];
        if (range === undefined) continue;
        all.push(range);
        if (hit.position !== activeIndex) continue;
        active.push(range);
        activeElement ??= element;
      }
    }
  }

  paint(ALL_MATCHES, all);
  paint(ACTIVE_MATCH, active);
  return activeElement;
}

/** The registry outlives React, so a reviewer that unmounts has to drop its ranges by hand. */
export function clearDiffSearch(): void {
  paint(ALL_MATCHES, []);
  paint(ACTIVE_MATCH, []);
}
