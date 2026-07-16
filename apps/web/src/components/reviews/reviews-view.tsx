import { EmptyState, ErrorState, Icon, RunStatusChip, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useRuns } from "@web/api/runs/queries";
import { CenteredState } from "@web/components/shell/centered-state";
import { RouteShell } from "@web/components/shell/route-shell";

const REVIEWABLE = new Set(["review_ready"]);

export function ReviewsView() {
  const runs = useRuns();
  const reviewable = (runs.data ?? []).filter((run) => REVIEWABLE.has(run.status));

  let body;
  if (runs.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-6">
        {[0, 1].map((row) => (
          <Skeleton key={row} height={48} />
        ))}
      </div>
    );
  } else if (runs.isError) {
    body = (
      <CenteredState>
        <ErrorState
          title="Couldn’t load reviews"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void runs.refetch()}
        />
      </CenteredState>
    );
  } else if (reviewable.length === 0) {
    body = (
      <CenteredState>
        <EmptyState
          icon="git-pull-request"
          title="Nothing waiting for review"
          description="Runs land here when their diff is ready for a line-by-line review."
        />
      </CenteredState>
    );
  } else {
    body = (
      <ul className="flex flex-col gap-0.5 px-2 py-2">
        {reviewable.map((run) => (
          <li key={run.id}>
            <Link
              to="/runs/$runId/diff"
              params={{ runId: run.id }}
              className="flex items-start gap-2.25 rounded-md px-2.5 py-2.25 hover:bg-hover focus-visible:[outline:2px_solid_var(--iris-ring)] focus-visible:outline-offset-[-2px]"
            >
              <Icon name="git-compare" aria-hidden className="mt-0.5 h-3.5 w-3.5 text-review" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  Run {run.id.slice(0, 8)}
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
  }

  return (
    <RouteShell
      active="reviews"
      titleIcon="git-pull-request"
      titleNote="Review run diffs line-by-line before opening a pull request."
      breadcrumbs={[{ label: "Reviews", current: true }]}
    >
      {body}
    </RouteShell>
  );
}
