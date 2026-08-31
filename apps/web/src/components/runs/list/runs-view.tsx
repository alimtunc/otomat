import { EmptyState } from "@otomat/ui";
import { useProjectIssues } from "@web/api/issues/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RunsTable } from "@web/components/runs/list/table";
import { RunsToolbar } from "@web/components/runs/list/toolbar";
import { useRunsView } from "@web/components/runs/list/use-runs-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { StaleNotice } from "@web/components/shell/stale-notice";
import { groupRunsByIssue, visibleRunGroups } from "@web/lib/run/grouping";

export function RunsView() {
  const selectedProject = useSelectedProject();
  const runs = useProjectRuns(selectedProject.projectId);
  const issues = useProjectIssues(selectedProject.projectId);
  const view = useRunsView(selectedProject.projectId);
  const visible = visibleRunGroups(
    groupRunsByIssue(runs.data ?? [], issues.data ?? []),
    view.config,
  );

  return (
    <RouteShell
      active="runs"
      titleIcon="activity"
      breadcrumbs={[{ label: "Runs", current: true }]}
      actions={
        <RunsToolbar
          config={view.config}
          hidden={{ runs: visible.hiddenRuns, groups: visible.hiddenGroups }}
          onChange={view.update}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {issues.isError && issues.data !== undefined ? (
          <StaleNotice
            dataUpdatedAt={issues.dataUpdatedAt}
            refreshing={issues.isFetching}
            onRetry={() => void issues.refetch()}
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <ProjectQueryBoundary query={selectedProject.projects}>
            <QueryList
              query={runs}
              pending={<ListSkeleton rows={3} height={40} />}
              error={
                <ErrorReport
                  error={runs.error}
                  context="Couldn’t load runs"
                  onRetry={() => void runs.refetch()}
                />
              }
              empty={
                <CenteredState>
                  <EmptyState
                    icon="activity"
                    title="No runs yet"
                    description="Launch a run from an issue to see it stream here."
                  />
                </CenteredState>
              }
            >
              {() =>
                visible.groups.length === 0 ? (
                  <p className="px-4.5 py-6 text-sm text-text-tertiary">
                    No runs match these filters.
                  </p>
                ) : (
                  <RunsTable groups={visible.groups} />
                )
              }
            </QueryList>
          </ProjectQueryBoundary>
        </div>
      </div>
    </RouteShell>
  );
}
