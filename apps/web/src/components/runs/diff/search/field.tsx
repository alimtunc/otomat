import { Icon, IconButton, Input } from "@otomat/ui";
import type { DiffSearch } from "@web/components/runs/diff/search/use-diff-search";
import { useFindShortcut } from "@web/components/runs/diff/search/use-find-shortcut";

export interface DiffSearchFieldProps {
  search: DiffSearch;
}

export function DiffSearchField({ search }: DiffSearchFieldProps) {
  const field = useFindShortcut();
  const total = search.matches.length;

  return (
    <span className="flex items-center gap-1">
      <Input
        ref={field}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            search.step(event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key !== "Escape") return;
          event.preventDefault();
          search.setQuery("");
          field.current?.blur();
        }}
        placeholder="Find in diff"
        aria-label="Find in the diff"
        icon={<Icon name="search" aria-hidden />}
        className="h-6.5 w-36 text-xs"
      />
      <span
        aria-live="polite"
        className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-text-tertiary"
      >
        {search.query === "" ? "" : `${search.activeIndex + 1}/${total}`}
      </span>
      <IconButton
        size="sm"
        label="Previous match"
        icon={<Icon name="arrow-up" />}
        disabled={total === 0}
        onClick={() => search.step(-1)}
      />
      <IconButton
        size="sm"
        label="Next match"
        icon={<Icon name="arrow-down" />}
        disabled={total === 0}
        onClick={() => search.step(1)}
      />
    </span>
  );
}
