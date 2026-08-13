import type { IssueContract } from "@otomat/domain";
import { applyAdvancedFilters, applyIssuesFilter } from "@web/lib/issue/filters";
import { groupIssues, type IssueGroup } from "@web/lib/issue/grouping";
import { sortIssues } from "@web/lib/issue/sort";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";

export function visibleIssueGroups(
  issues: IssueContract[],
  config: IssuesViewConfig,
  projectNames: ReadonlyMap<string, string>,
): IssueGroup[] {
  const filtered = applyAdvancedFilters(applyIssuesFilter(issues, config.filter), config.advanced);
  return groupIssues(sortIssues(filtered, config.sort), config.grouping, projectNames);
}
