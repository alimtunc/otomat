import { usePullRequestInbox } from "@web/api/reviews/queries";
import { usePullRequestInboxSync } from "@web/api/reviews/use-inbox-sync";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { ReviewInboxEmpty } from "@web/components/reviews/empty-state";
import { ReviewInboxFilters } from "@web/components/reviews/filters-menu";
import { ReviewInboxGroup } from "@web/components/reviews/group-section";
import { ReviewSyncControl } from "@web/components/reviews/sync-control";
import { ReviewSyncNotice } from "@web/components/reviews/sync-notice";
import { useInboxView } from "@web/components/reviews/use-inbox-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import { applyInboxFilters } from "@web/lib/pull-request/inbox/filters";
import { groupInboxEntries } from "@web/lib/pull-request/inbox/groups";
import { inboxFilterOptions } from "@web/lib/pull-request/inbox/options";

export function ReviewsView() {
  const selectedProject = useSelectedProject();
  const projectId = selectedProject.projectId;
  const inbox = usePullRequestInbox(projectId);
  const sync = usePullRequestInboxSync(projectId);
  const view = useInboxView(projectId);

  return (
    <RouteShell
      active="reviews"
      titleIcon="git-pull-request"
      titleNote="Every open pull request of this project, grouped by what it needs."
      breadcrumbs={[{ label: "Reviews", current: true }]}
      actions={
        <div className="flex items-center gap-2">
          <ReviewInboxFilters
            filters={view.config.filters}
            options={inboxFilterOptions(inbox.data?.entries ?? [])}
            onChange={view.setFilters}
          />
          <ReviewSyncControl sync={sync} />
        </div>
      }
    >
      <ProjectQueryBoundary query={selectedProject.projects}>
        <QueryBoundary
          query={inbox}
          pending={<ListSkeleton rows={3} height={52} />}
          error={
            <ErrorReport
              error={inbox.error}
              context="Couldn’t load the pull-request inbox"
              onRetry={() => void inbox.refetch()}
            />
          }
        >
          {(data) => {
            const entries = applyInboxFilters(data.entries, view.config.filters);
            const groups = groupInboxEntries(entries);
            return (
              <>
                {sync.last_error === null ? null : (
                  <ReviewSyncNotice sync={sync} message={sync.last_error.message} />
                )}
                {data.viewer.login === null || data.viewer.teams_known ? null : (
                  <p className="m-0 border-b border-border-subtle px-3 py-1.5 text-xs text-text-tertiary">
                    GitHub did not say which teams @{data.viewer.login} belongs to, so pull requests
                    waiting on a team review cannot be matched.
                  </p>
                )}
                {groups.length === 0 ? (
                  <CenteredState>
                    <ReviewInboxEmpty
                      inbox={data}
                      filtered={entries.length !== data.entries.length}
                    />
                  </CenteredState>
                ) : (
                  <div className="flex flex-col py-1">
                    {groups.map((section) => (
                      <ReviewInboxGroup
                        key={section.group}
                        group={section.group}
                        entries={section.entries}
                        collapsed={view.config.collapsedGroups.includes(section.group)}
                        onToggle={view.toggleGroup}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </QueryBoundary>
      </ProjectQueryBoundary>
    </RouteShell>
  );
}
