import { EmptyState } from "@otomat/ui";
import { useReviewQueue } from "@web/api/reviews/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { ReviewQueueRow } from "@web/components/reviews/entry-row";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";

const EMPTY = (
  <CenteredState>
    <EmptyState
      icon="git-pull-request"
      title="Nothing waiting for review"
      description="Runs land here when their diff is ready, and so do the pull requests attached to an issue."
    />
  </CenteredState>
);

export function ReviewsView() {
  const selectedProject = useSelectedProject();
  const reviews = useReviewQueue(selectedProject.projectId);
  return (
    <RouteShell
      active="reviews"
      titleIcon="git-pull-request"
      titleNote="Review a run's diff or an attached pull request, line by line."
      breadcrumbs={[{ label: "Reviews", current: true }]}
    >
      <ProjectQueryBoundary query={selectedProject.projects}>
        <QueryList
          query={reviews}
          pending={<ListSkeleton rows={2} height={48} />}
          error={
            <ErrorReport
              error={reviews.error}
              context="Couldn’t load reviews"
              onRetry={() => void reviews.refetch()}
            />
          }
          empty={EMPTY}
        >
          {(items) => (
            <ul className="flex flex-col gap-0.5 px-2 py-2">
              {items.map((entry) => (
                <li key={`${entry.kind}:${entry.id}`}>
                  <ReviewQueueRow entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </QueryList>
      </ProjectQueryBoundary>
    </RouteShell>
  );
}
