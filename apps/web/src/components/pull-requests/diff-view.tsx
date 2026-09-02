import { Button, EmptyState, ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { usePullRequestReviewContext } from "@web/api/prs/queries";
import { usePullRequestReconciliation } from "@web/api/prs/use-reconciliation";
import { ReviewDiffView } from "@web/components/runs/diff/review-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { StaleNotice } from "@web/components/shell/stale-notice";

const HEAD_UNREACHABLE =
  "Otomat holds no fetched head for this pull request. Fetch it to read its diff here.";

const HEAD_FETCHING = "Otomat is reading this pull request from GitHub and fetching its head.";

export function PullRequestDiffView() {
  const { pullRequestId } = useParams({ from: "/pull-requests/$pullRequestId/diff" });
  const query = usePullRequestReviewContext(pullRequestId);
  const pullRequest = query.data?.pull_request;
  const reconciliation = usePullRequestReconciliation(pullRequestId, pullRequest?.issue_id ?? null);

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
      {(context) => (
        <>
          {reconciliation.failure === null ? null : (
            <StaleNotice
              dataUpdatedAt={query.dataUpdatedAt}
              refreshing={reconciliation.running}
              onRetry={reconciliation.retry}
              reason={reconciliation.failure}
            />
          )}
          {context.pull_request.head_sha === null ? (
            <CenteredState>
              <EmptyState
                icon="git-compare"
                title={reconciliation.running ? "Fetching the head…" : "No fetched head"}
                description={reconciliation.running ? HEAD_FETCHING : HEAD_UNREACHABLE}
                action={
                  reconciliation.running ? undefined : (
                    <Button size="sm" onClick={reconciliation.retry}>
                      Fetch from GitHub
                    </Button>
                  )
                }
              />
            </CenteredState>
          ) : (
            <ReviewDiffView
              target={{ kind: "pull_request", id: pullRequestId }}
              workspace={{ open: false, issueId: context.pull_request.issue_id }}
              emptyDescription={HEAD_UNREACHABLE}
            />
          )}
        </>
      )}
    </QueryBoundary>
  );
}
