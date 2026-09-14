import type { DiffFileContract } from "@otomat/domain";
import { useForm, useStore } from "@tanstack/react-form";
import { findDiffMatches, indexDiffLines } from "@web/components/runs/diff/search/matches";
import { useMemo, useState } from "react";

export type DiffSearch = ReturnType<typeof useDiffSearch>;

/** `files` keys the index so hiding or re-sorting never reparses; `order` only sets the walk order. */
export function useDiffSearch(
  files: readonly DiffFileContract[],
  order: readonly DiffFileContract[],
) {
  const form = useForm({ defaultValues: { query: "" } });
  const query = useStore(form.store, (state) => state.values.query);
  const [cursor, setCursor] = useState(0);
  const index = useMemo(() => indexDiffLines(files), [files]);
  const matches = useMemo(() => findDiffMatches(order, index, query), [order, index, query]);
  const total = matches.length;

  return {
    form,
    query,
    matches,
    activeIndex: total === 0 ? -1 : ((cursor % total) + total) % total,
    cursor,
    setQuery: (next: string) => {
      form.setFieldValue("query", next);
      setCursor(0);
    },
    step: (direction: 1 | -1) => {
      if (total === 0) return;
      setCursor((current) => current + direction);
    },
  };
}
