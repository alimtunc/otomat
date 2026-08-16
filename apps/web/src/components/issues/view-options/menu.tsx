import {
  ConfigMenu,
  ConfigMenuContent,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
} from "@otomat/ui";
import { IssueFilterSubmenus } from "@web/components/issues/view-options/filter-submenus";
import { IssueLinearFilters } from "@web/components/issues/view-options/linear-filters";
import { Select } from "@web/components/issues/view-options/select";
import { issuesConfigDetails, issuesConfigSegments } from "@web/lib/issue/config-summary";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import { activeAdvancedFilterCount, NO_ADVANCED_FILTERS } from "@web/lib/issue/filters";
import { ISSUE_GROUPING_OPTIONS } from "@web/lib/issue/grouping";
import { ISSUE_SORT_OPTIONS } from "@web/lib/issue/sort";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";

const MENU_LABEL = "View options";

export interface IssueViewOptionsMenuProps {
  config: IssuesViewConfig;
  options: IssueFilterOptions;
  linearMapped: boolean;
  dirty: boolean;
  onChange: (patch: Partial<IssuesViewConfig>) => void;
  onReset: () => void;
}

export function IssueViewOptionsMenu({
  config,
  options,
  linearMapped,
  dirty,
  onChange,
  onReset,
}: IssueViewOptionsMenuProps) {
  const filtered = activeAdvancedFilterCount(config.advanced) > 0;

  return (
    <ConfigMenu>
      <ConfigMenuTrigger
        label={MENU_LABEL}
        summary={issuesConfigSegments(config).join(" · ")}
        detail={
          <span className="flex flex-col gap-0.5">
            {issuesConfigDetails(config, options).map((entry) => (
              <span key={entry.label}>
                <b className="font-medium">{entry.label}:</b> {entry.value}
              </span>
            ))}
          </span>
        }
        leading={<Icon name="sliders-horizontal" aria-hidden className="shrink-0" />}
      />
      <ConfigMenuContent aria-label={MENU_LABEL}>
        <Select
          label="Group"
          items={ISSUE_GROUPING_OPTIONS}
          value={config.grouping}
          onChange={(grouping) => onChange({ grouping })}
        />
        <Select
          label="Sort"
          items={ISSUE_SORT_OPTIONS}
          value={config.sort}
          onChange={(sort) => onChange({ sort })}
        />
        <DropdownMenuSeparator />
        <IssueFilterSubmenus
          filters={config.advanced}
          options={options}
          onChange={(advanced) => onChange({ advanced })}
        />
        <IssueLinearFilters
          mapped={linearMapped}
          filters={config.advanced}
          options={options}
          onChange={(advanced) => onChange({ advanced })}
        />
        {filtered || dirty ? <DropdownMenuSeparator /> : null}
        {filtered ? (
          <DropdownMenuItem onClick={() => onChange({ advanced: NO_ADVANCED_FILTERS })}>
            Clear filters
          </DropdownMenuItem>
        ) : null}
        {dirty ? <DropdownMenuItem onClick={onReset}>Reset view</DropdownMenuItem> : null}
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
