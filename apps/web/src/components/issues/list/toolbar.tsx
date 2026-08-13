import type { IssueContract } from "@otomat/domain";
import { Chip, Pill, PillTabs } from "@otomat/ui";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssuesFilterPopover } from "@web/components/issues/issues-filter-popover";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { DisplaySelect } from "@web/components/issues/list/display-select";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { asMember } from "@web/lib/coerce";
import {
  assigneeOptions,
  labelOptions,
  linearStateOptions,
  projectOptions,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import { ISSUES_FILTERS } from "@web/lib/issue/filters";
import { ISSUE_GROUPING_OPTIONS } from "@web/lib/issue/grouping";
import { unmatchedFilterValues } from "@web/lib/issue/invalid-filters";
import { ISSUE_SORT_OPTIONS } from "@web/lib/issue/sort";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";
import { TOOLBAR_STRIP } from "@web/lib/toolbar";

export interface IssuesToolbarProps {
  config: IssuesViewConfig;
  /** Every loaded issue, so the filter options and the stale-value notice describe this project. */
  issues: IssueContract[];
  projectNames: ReadonlyMap<string, string>;
  sync: ProjectLinearSync;
  onChange: (patch: Partial<IssuesViewConfig>) => void;
}

export function IssuesToolbar({
  config,
  issues,
  projectNames,
  sync,
  onChange,
}: IssuesToolbarProps) {
  const options: IssueFilterOptions = {
    assignees: assigneeOptions(issues),
    linearStates: linearStateOptions(issues),
    labels: labelOptions(issues),
    projects: projectOptions(issues, projectNames),
  };
  const unmatched = unmatchedFilterValues(config.advanced, options);
  return (
    <div className={`${TOOLBAR_STRIP} overflow-x-auto`}>
      <PillTabs
        type="single"
        value={config.filter}
        onValueChange={(value) => {
          const filter = asMember(value, ISSUES_FILTERS);
          if (filter !== null) onChange({ filter });
        }}
        aria-label="Issue filter"
      >
        <Pill value="all">All</Pill>
        <Pill value="active">Active</Pill>
        <Pill value="backlog">Backlog</Pill>
      </PillTabs>
      <DisplaySelect
        label="Group"
        options={ISSUE_GROUPING_OPTIONS}
        value={config.grouping}
        onChange={(grouping) => onChange({ grouping })}
      />
      <DisplaySelect
        label="Sort"
        options={ISSUE_SORT_OPTIONS}
        value={config.sort}
        onChange={(sort) => onChange({ sort })}
      />
      <IssuesFilterPopover
        filters={config.advanced}
        options={options}
        onChange={(advanced) => onChange({ advanced })}
      />
      {unmatched.length === 0 ? null : (
        <Chip tone="warning" title={unmatched.join(", ")}>
          {unmatched.length === 1
            ? "1 filter matches nothing"
            : `${unmatched.length} filters match nothing`}
        </Chip>
      )}
      <div className="flex-1" />
      <LinearSyncControl sync={sync} />
      <NewIssueButton />
    </div>
  );
}
