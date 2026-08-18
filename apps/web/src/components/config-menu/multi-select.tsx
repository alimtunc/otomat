import { ConfigMenuCheck, ConfigMenuSubmenu } from "@otomat/ui";
import type { ReactNode } from "react";

const SHOWN = 2;

interface MultiSelectItem<T extends string> {
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
  const hidden = selectedLabels.length - SHOWN;
  const summary =
    hidden > 0
      ? `${selectedLabels.slice(0, SHOWN).join(", ")} +${hidden}`
      : selectedLabels.join(", ");

  return (
    <ConfigMenuSubmenu
      label={label}
      value={selected.length === 0 ? emptyLabel : summary}
      hint={hidden > 0 ? selectedLabels.join(", ") : undefined}
    >
      {items.map((item) => (
        <ConfigMenuCheck
          key={item.value}
          label={item.label}
          checked={selectedSet.has(item.value)}
          onCheckedChange={() => onChange(toggle(selected, item.value))}
          leading={renderLeading?.(item)}
        />
      ))}
    </ConfigMenuSubmenu>
  );
}
