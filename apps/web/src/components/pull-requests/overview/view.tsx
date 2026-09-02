import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { usePullRequestOverview } from "@web/api/prs/queries";
import { PullRequestChecks } from "@web/components/pull-requests/overview/checks";
import { PullRequestMergePanel } from "@web/components/pull-requests/overview/merge-panel";
import { PullRequestReviewers } from "@web/components/pull-requests/overview/reviewers";
import { PullRequestOverviewSummary } from "@web/components/pull-requests/overview/summary";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function PullRequestOverviewView() {
  const { pullRequestId } = useParams({ from: "/pull-requests/$pullRequestId/overview" });
  const query = usePullRequestOverview(pullRequestId);

  return (
    <QueryBoundary
      query={query}
      pending={<DetailSkeleton blocks={3} />}
      error={
        <CenteredState>
          <ErrorState
            title="Could not read this pull request from GitHub"
            description="It may have been detached, or gh could not reach GitHub."
            onRetry={() => void query.refetch()}
          />
        </CenteredState>
      }
    >
      {(overview) => (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
          <PullRequestOverviewSummary overview={overview} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PullRequestChecks checks={overview.checks} />
            <PullRequestReviewers overview={overview} />
          </div>
          <PullRequestMergePanel overview={overview} />
        </div>
      )}
    </QueryBoundary>
  );
}
