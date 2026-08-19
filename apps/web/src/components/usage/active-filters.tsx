import { Button, Icon } from "@otomat/ui";
import type { UsageFacetChip } from "@web/lib/usage/facets";

export interface UsageActiveFiltersProps {
  chips: UsageFacetChip[];
  onRemove: (chip: UsageFacetChip) => void;
  onClear: () => void;
}

export function UsageActiveFilters({ chips, onRemove, onClear }: UsageActiveFiltersProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border-subtle px-4.5 py-1.5">
      {chips.map((chip) => (
        <button
          key={`${chip.axis}:${chip.value}`}
          type="button"
          onClick={() => onRemove(chip)}
          aria-label={`Remove filter ${chip.label}`}
          className="inline-flex h-5.5 max-w-64 items-center gap-1 rounded-sm bg-surface-2 px-1.75 text-xs text-text-secondary hover:bg-hover"
        >
          <span className="truncate">{chip.label}</span>
          <Icon name="x" aria-hidden className="size-3 shrink-0 text-text-tertiary" />
        </button>
      ))}
      <Button type="button" variant="ghost" size="xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
