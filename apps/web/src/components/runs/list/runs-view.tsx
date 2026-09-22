import { EmptyState, Icon } from "@otomat/ui";
import { useProjectIssueSummaries } from "@web/api/issues/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RunsTable } from "@web/components/runs/list/table";
import { RunsToolbar } from "@web/components/runs/list/toolbar";
import { useRunsView } from "@web/components/runs/list/use-runs-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { IconLink } from "@web/components/shell/icon-link";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { StaleNotice } from "@web/components/shell/stale-notice";
import { useActiveHostId } from "@web/lib/active-host";
import { groupRunsByIssue, visibleRunGroups } from "@web/lib/run/grouping";

export function RunsView() {
  const selectedProject = useSelectedProject();
  const host = useActiveHostId();
  const runs = useProjectRuns(selectedProject.projectId);
  const issues = useProjectIssueSummaries(selectedProject.projectId);
  const view = useRunsView(selectedProject.projectId);
  const scrollId = `runs:${host}:${selectedProject.projectId}:${JSON.stringify(view.config)}`;
  const visible = visibleRunGroups(
    groupRunsByIssue(runs.data ?? [], issues.data ?? []),
    view.config,
  );

  return (
    <RouteShell
      titleIcon="activity"
      breadcrumbs={[{ label: "Runs", current: true }]}
      actions={
        <div className="flex items-center gap-1">
          <IconLink
            to="/conversations"
            label="Conversations"
            icon={<Icon name="message-square" aria-hidden />}
          />
          <RunsToolbar
            config={view.config}
            hidden={{ runs: visible.hiddenRuns, groups: visible.hiddenGroups }}
            onChange={view.update}
          />
        </div>
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
          <ProjectQueryBoundary query={selectedProject.projects} unselectedIcon="activity">
            <QueryList
              query={runs}
              pending={<ListSkeleton rows={12} height={40} header />}
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
                  <RunsTable key={scrollId} groups={visible.groups} scrollId={scrollId} />
                )
              }
            </QueryList>
          </ProjectQueryBoundary>
        </div>
      </div>
    </RouteShell>
  );
}
