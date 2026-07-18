import { EmptyState, Icon, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRuns } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { DaemonUnreachableState } from "@web/components/shell/daemon-unreachable-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { FOCUS_RING } from "@web/lib/focus";
import { shortId } from "@web/lib/ids";
import { isReviewable } from "@web/lib/run-filters";

const EMPTY = (
  <CenteredState>
    <EmptyState
      icon="git-pull-request"
      title="Nothing waiting for review"
      description="Runs land here when their diff is ready for a line-by-line review."
    />
  </CenteredState>
);

export function ReviewsView() {
  const runs = useRuns();
  return (
    <RouteShell
      active="reviews"
      titleIcon="git-pull-request"
      titleNote="Review run diffs line-by-line before opening a pull request."
      breadcrumbs={[{ label: "Reviews", current: true }]}
    >
      <QueryList
        query={runs}
        pending={<ListSkeleton rows={2} height={48} />}
        error={
          <DaemonUnreachableState
            title="Couldn’t load reviews"
            onRetry={() => void runs.refetch()}
          />
        }
        empty={EMPTY}
      >
        {(items) => {
          const reviewable = items.filter(isReviewable);
          if (reviewable.length === 0) return EMPTY;
          return (
            <ul className="flex flex-col gap-0.5 px-2 py-2">
              {reviewable.map((run) => (
                <li key={run.id}>
                  <Link
                    to="/runs/$runId/diff"
                    params={{ runId: run.id }}
                    className={`flex items-start gap-2.25 rounded-md px-2.5 py-2.25 hover:bg-hover ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
                  >
                    <Icon
                      name="git-compare"
                      aria-hidden
                      className="mt-0.5 h-3.5 w-3.5 text-review"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        Run {shortId(run.id)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-text-tertiary">
                        {run.branch}
                      </span>
                    </span>
                    <RunStatusChip status={run.status} />
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </QueryList>
    </RouteShell>
  );
}
