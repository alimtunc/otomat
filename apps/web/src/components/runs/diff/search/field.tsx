import { Button, Icon, IconButton, Input, cn } from "@otomat/ui";
import type { DiffSearch } from "@web/components/runs/diff/search/use-diff-search";
import { useFindShortcut } from "@web/components/runs/diff/search/use-find-shortcut";
import { useRef, useState } from "react";

export interface DiffSearchFieldProps {
  search: DiffSearch;
}

export function DiffSearchField({ search }: DiffSearchFieldProps) {
  const field = useFindShortcut();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLSpanElement>(null);
  const total = search.matches.length;

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <span ref={trigger} className={open ? "sr-only" : "shrink-0"}>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Find in diff"
          className="px-1.5"
          tabIndex={open ? -1 : 0}
          onClick={() => field.current?.focus()}
        >
          <Icon name="search" />
        </Button>
      </span>
      <span
        aria-hidden={!open}
        className={cn("flex shrink-0 items-center gap-0.5", !open && "sr-only")}
      >
        <search.form.Field name="query">
          {(queryField) => (
            <span className="relative flex shrink-0 items-center">
              <Input
                ref={field}
                value={queryField.state.value}
                tabIndex={open ? 0 : -1}
                onFocus={() => setOpen(true)}
                onBlur={queryField.handleBlur}
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
                  setOpen(false);
                  trigger.current?.querySelector("button")?.focus();
                }}
                placeholder="Find in diff"
                aria-label="Find in the diff"
                icon={<Icon name="search" aria-hidden />}
                className="h-6.5 w-27.5 min-w-27.5 pr-10 text-xs selection:bg-iris selection:text-on-accent"
              />
              <span
                aria-live="polite"
                aria-label="Search matches"
                className="pointer-events-none absolute right-1.5 font-mono text-micro tabular-nums text-text-tertiary"
              >
                {search.query === "" ? "" : `${search.activeIndex + 1}/${total}`}
              </span>
            </span>
          )}
        </search.form.Field>
        <IconButton
          size="sm"
          label="Previous match"
          icon={<Icon name="arrow-up" />}
          tabIndex={open ? 0 : -1}
          disabled={total === 0}
          onClick={() => search.step(-1)}
        />
        <IconButton
          size="sm"
          label="Next match"
          icon={<Icon name="arrow-down" />}
          tabIndex={open ? 0 : -1}
          disabled={total === 0}
          onClick={() => search.step(1)}
        />
      </span>
    </span>
  );
}
