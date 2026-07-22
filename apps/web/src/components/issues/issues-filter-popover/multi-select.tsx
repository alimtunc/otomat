import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
} from "@otomat/ui";
import { FOCUS_RING } from "@web/lib/focus";
import type { ReactNode } from "react";

export interface MultiSelectItem<T extends string> {
  value: T;
  label: string;
}

function toggle<T extends string>(selected: readonly T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];
}

export function MultiSelect<T extends string, TItem extends MultiSelectItem<T>>({
  label,
  emptyLabel,
  items,
  selected,
  renderLeading,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  items: TItem[];
  selected: T[];
  renderLeading?: (item: TItem) => ReactNode;
  onChange: (selected: T[]) => void;
}) {
  const selectedSet = new Set(selected);
  const selectedLabels: string[] = [];
  for (const item of items) {
    if (selectedSet.has(item.value)) selectedLabels.push(item.label);
  }
  const summary = selected.length === 0 ? emptyLabel : selectedLabels.join(", ");

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-tertiary">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={label}
          className={`flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-foreground ${FOCUS_RING}`}
        >
          <span className="truncate">{summary}</span>
          <Icon name="chevron-down" size="xs" className="text-text-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-(--anchor-width)">
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={selectedSet.has(item.value)}
              closeOnClick={false}
              onCheckedChange={() => onChange(toggle(selected, item.value))}
            >
              <span className="inline-flex items-center gap-2">
                {renderLeading?.(item)}
                {item.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
