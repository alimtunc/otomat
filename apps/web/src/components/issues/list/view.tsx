import { Icon, Pill, PillTabs, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useProjectIssues } from "@web/api/issues/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssuesFilterPopover } from "@web/components/issues/issues-filter-popover";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { IssuesContent } from "@web/components/issues/list/content";
import {
  fromAdvancedFilters,
  isIssuesLayout,
  toAdvancedFilters,
  type IssuesListSearch,
} from "@web/components/issues/list/search";
import { NewIssueButton } from "@web/components/issues/new-issue-button";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { RouteShell } from "@web/components/shell/route-shell";
import {
  applyAdvancedFilters,
  applyIssuesFilter,
  assigneeOptions,
  isIssuesFilter,
  stateOptions,
} from "@web/lib/issue/filters";
import { useEffect } from "react";

export function IssuesView() {
  const selectedProject = useSelectedProject();
  const issues = useProjectIssues(selectedProject.projectId);
  const sync = useProjectLinearSync(selectedProject.projectId);
  const search = useSearch({ from: "/issues/" });
  const navigate = useNavigate({ from: "/issues/" });
  const layout = search.layout ?? "board";
  const filter = search.filter ?? "all";
  const advanced = toAdvancedFilters(search);

  const refine = (next: IssuesListSearch): void => {
    void navigate({ to: "/issues", search: (prev) => ({ ...prev, ...next }), replace: true });
  };

  const { refreshIfStale } = sync;
  // otomat-allow-effect: fires on entry and each sync-status change; the staleness guard bounds it.
  useEffect(() => {
    refreshIfStale();
  }, [refreshIfStale]);

  return (
    <RouteShell
      active="issues"
      titleIcon="list-todo"
      breadcrumbs={[{ label: "Issues", current: true }]}
      actions={
        <SegmentedControl
          type="single"
          value={layout}
          onValueChange={(value) => {
            if (isIssuesLayout(value)) refine({ layout: value });
          }}
          aria-label="Issues layout"
        >
          <SegmentedItem value="board" icon={<Icon name="columns-3" />}>
            Board
          </SegmentedItem>
          <SegmentedItem value="list" icon={<Icon name="list" />}>
            List
          </SegmentedItem>
        </SegmentedControl>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10.5 flex-none items-center gap-2 border-b border-border-subtle px-4.5">
          <PillTabs
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (isIssuesFilter(value)) refine({ filter: value });
            }}
            aria-label="Issue filter"
          >
            <Pill value="all">All</Pill>
            <Pill value="active">Active</Pill>
            <Pill value="backlog">Backlog</Pill>
          </PillTabs>
          <div className="flex-1" />
          <LinearSyncControl sync={sync} />
          <IssuesFilterPopover
            filters={advanced}
            assignees={assigneeOptions(issues.data ?? [])}
            states={stateOptions(issues.data ?? [])}
            onChange={(next) => refine(fromAdvancedFilters(next))}
          />
          <NewIssueButton />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <ProjectQueryBoundary query={selectedProject.projects}>
            <IssuesContent
              query={issues}
              filter={(items) => applyAdvancedFilters(applyIssuesFilter(items, filter), advanced)}
              board={layout === "board"}
            />
          </ProjectQueryBoundary>
        </div>
      </div>
    </RouteShell>
  );
}
