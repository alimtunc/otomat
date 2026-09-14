import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useGitHubConnection, useRunPullRequest } from "@web/api/prs/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { RunPrLoaded } from "@web/components/runs/pr/loaded";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function RunPrView() {
  const { runId } = useParams({ from: "/runs/$runId/pr" });
  const runQuery = useRunDetail(runId);
  const prQuery = useRunPullRequest(runId);
  const connectionQuery = useGitHubConnection();

  const pending = <DetailSkeleton blockClassName="h-40 w-full max-w-2xl" />;
  const error = (
    <CenteredState>
      <ErrorState
        title="Could not load GitHub publication state"
        description="The daemon did not answer. Check that it is running."
        onRetry={() => {
          void Promise.all([runQuery.refetch(), prQuery.refetch(), connectionQuery.refetch()]);
        }}
      />
    </CenteredState>
  );
  return (
    <QueryBoundary query={runQuery} pending={pending} error={error}>
      {(run) => (
        <QueryBoundary query={prQuery} pending={pending} error={error}>
          {(publication) => (
            <QueryBoundary query={connectionQuery} pending={pending} error={error}>
              {(connection) => (
                <RunPrLoaded
                  runId={runId}
                  run={run}
                  publication={publication}
                  connection={connection}
                />
              )}
            </QueryBoundary>
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}
