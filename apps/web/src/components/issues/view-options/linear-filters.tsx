import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  IssueSourceGlyph,
} from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { MultiSelect } from "@web/components/issues/view-options/multi-select";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import type { AdvancedIssueFilters } from "@web/lib/issue/filters";

export interface IssueLinearFiltersProps {
  mapped: boolean;
  filters: AdvancedIssueFilters;
  options: IssueFilterOptions;
  onChange: (next: AdvancedIssueFilters) => void;
}

export function IssueLinearFilters({
  mapped,
  filters,
  options,
  onChange,
}: IssueLinearFiltersProps) {
  const selected = filters.sources.length === 0 || filters.sources.includes("linear");
  if (!mapped || !selected || options.linearStates.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          <span className="flex items-center gap-1.5">
            <IssueSourceGlyph source="linear" />
            Linear
          </span>
        </DropdownMenuLabel>
        <MultiSelect
          label="Linear state"
          emptyLabel="Any state"
          items={options.linearStates}
          selected={filters.linearStates}
          renderLeading={(item) => <ColorDot color={item.color ?? null} />}
          onChange={(linearStates) => onChange({ ...filters, linearStates })}
        />
      </DropdownMenuGroup>
    </>
  );
}
