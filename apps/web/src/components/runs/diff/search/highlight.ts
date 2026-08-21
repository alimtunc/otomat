import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import type { DiffSearchMatch } from "@web/components/runs/diff/search/matches";
import { rangesAtOffsets } from "@web/components/runs/diff/search/ranges";
import { lineTextElements } from "@web/components/runs/diff/search/rows";

/** Must match the `::highlight()` rules in `review-diff.css`. */
const ALL_MATCHES = "otomat-diff-search";
const ACTIVE_MATCH = "otomat-diff-search-active";

interface LineHit {
  position: number;
  offset: number;
}

interface LineGroup {
  path: string;
  oldLine: number | null;
  newLine: number | null;
  hits: LineHit[];
}

const groupsByMatches = new WeakMap<readonly DiffSearchMatch[], LineGroup[]>();

function groupByLine(matches: readonly DiffSearchMatch[]): LineGroup[] {
  const cached = groupsByMatches.get(matches);
  if (cached !== undefined) return cached;
  const groups: LineGroup[] = [];
  let position = 0;
  for (const match of matches) {
    const current = groups.at(-1);
    if (
      current !== undefined &&
      current.path === match.path &&
      current.oldLine === match.oldLine &&
      current.newLine === match.newLine
    ) {
      current.hits.push({ position, offset: match.offset });
    } else {
      groups.push({
        path: match.path,
        oldLine: match.oldLine,
        newLine: match.newLine,
        hits: [{ position, offset: match.offset }],
      });
    }
    position += 1;
  }
  groupsByMatches.set(matches, groups);
  return groups;
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
      const ranges = rangesAtOffsets(
        element,
        group.hits.map((hit) => hit.offset),
        query.length,
      );
      let index = 0;
      for (const hit of group.hits) {
        const range = ranges[index];
        if (range !== null && range !== undefined) {
          all.push(range);
          if (hit.position === activeIndex) {
            active.push(range);
            activeElement ??= element;
          }
        }
        index += 1;
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
