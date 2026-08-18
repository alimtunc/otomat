import { EmptyState, ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useAttachedPullRequest } from "@web/api/prs/queries";
import { ReviewDiffView } from "@web/components/runs/diff/review-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";

const HEAD_UNREACHABLE =
  "Otomat holds no fetched head for this pull request. Refresh it from the issue to fetch it again.";

/** An adopted pull request is reviewed through the same surface as a run — read-only, pinned to its imported head. */
export function PullRequestDiffView() {
  const { pullRequestId } = useParams({ from: "/pull-requests/$pullRequestId/diff" });
  const query = useAttachedPullRequest(pullRequestId);

  return (
    <QueryBoundary
      query={query}
      pending={<DetailSkeleton blocks={2} />}
      error={
        <CenteredState>
          <ErrorState
            title="Could not load this pull request"
            description="It may have been detached, or the daemon did not answer."
            onRetry={() => void query.refetch()}
          />
        </CenteredState>
      }
    >
      {(pullRequest) =>
        pullRequest.head_sha === null ? (
          <CenteredState>
            <EmptyState
              icon="git-compare"
              title="No imported head"
              description={HEAD_UNREACHABLE}
            />
          </CenteredState>
        ) : (
          <ReviewDiffView
            target={{ kind: "pull_request", id: pullRequestId }}
            workspace={{ open: false, issueId: pullRequest.issue_id }}
            emptyDescription={HEAD_UNREACHABLE}
          />
        )
      }
    </QueryBoundary>
  );
}
