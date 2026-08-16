import type { IssueContract } from "@otomat/domain";
import { Chip } from "@otomat/ui";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { linearSourcesMapped } from "@web/components/issues/linear-sync/describe";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { IssueViewOptionsMenu } from "@web/components/issues/view-options/menu";
import {
  assigneeOptions,
  labelOptions,
  linearStateOptions,
  projectOptions,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import { unmatchedFilterValues } from "@web/lib/issue/invalid-filters";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";
import { TOOLBAR_STRIP } from "@web/lib/toolbar";

export interface IssuesToolbarProps {
  config: IssuesViewConfig;
  /** Every loaded issue, so the filter options and the stale-value notice describe this project. */
  issues: IssueContract[];
  projectNames: ReadonlyMap<string, string>;
  sync: ProjectLinearSync;
  dirty: boolean;
  onChange: (patch: Partial<IssuesViewConfig>) => void;
  onReset: () => void;
}

export function IssuesToolbar({
  config,
  issues,
  projectNames,
  sync,
  dirty,
  onChange,
  onReset,
}: IssuesToolbarProps) {
  const options: IssueFilterOptions = {
    assignees: assigneeOptions(issues),
    linearStates: linearStateOptions(issues),
    labels: labelOptions(issues),
    projects: projectOptions(issues, projectNames),
  };
  const unmatched = unmatchedFilterValues(config.advanced, options);
  return (
    <div className={TOOLBAR_STRIP}>
      <IssueViewOptionsMenu
        config={config}
        options={options}
        linearMapped={linearSourcesMapped(sync.status)}
        dirty={dirty}
        onChange={onChange}
        onReset={onReset}
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
