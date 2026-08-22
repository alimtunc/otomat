import type { DiffFileContract } from "@otomat/domain";
import {
  findDiffMatches,
  indexDiffLines,
  type DiffSearchMatch,
} from "@web/components/runs/diff/search/matches";
import { useMemo, useState } from "react";

export interface DiffSearch {
  query: string;
  matches: readonly DiffSearchMatch[];
  /** -1 while the query matches nothing, so the counter reads 0 of 0. */
  activeIndex: number;
  /** Counts every explicit step, so re-centring a sole match still reads as a move. */
  cursor: number;
  setQuery: (query: string) => void;
  step: (direction: 1 | -1) => void;
}

/** `files` keys the index so hiding or re-sorting never reparses; `order` only sets the walk order. */
export function useDiffSearch(
  files: readonly DiffFileContract[],
  order: readonly DiffFileContract[],
): DiffSearch {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const index = useMemo(() => indexDiffLines(files), [files]);
  const matches = useMemo(() => findDiffMatches(order, index, query), [order, index, query]);
  const total = matches.length;

  return {
    query,
    matches,
    activeIndex: total === 0 ? -1 : ((cursor % total) + total) % total,
    cursor,
    setQuery: (next) => {
      setQuery(next);
      setCursor(0);
    },
    step: (direction) => {
      if (total === 0) return;
      setCursor((current) => current + direction);
    },
  };
}
