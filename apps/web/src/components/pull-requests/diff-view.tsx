import { Button, EmptyState, ErrorState, type BreadcrumbItem } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRefreshPullRequest } from "@web/api/prs/mutations";
import { useAttachedPullRequest } from "@web/api/prs/queries";
import { ReviewDiffView } from "@web/components/runs/diff/review-view";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";
import { useBackNavigation } from "@web/components/shell/use-back-navigation";
import { pullRequestLabel } from "@web/lib/pull-request/label";

const HEAD_UNREACHABLE =
  "Otomat holds no fetched head for this pull request. Fetch it to read its diff here.";

/** A mirrored pull request is reviewed through the same surface as a run — read-only, pinned to its imported head. */
export function PullRequestDiffView() {
  const { pullRequestId } = useParams({ from: "/pull-requests/$pullRequestId/diff" });
  const query = useAttachedPullRequest(pullRequestId);
  const refresh = useRefreshPullRequest(query.data?.issue_id ?? null);
  const back = useBackNavigation(null);

  const pullRequestCrumb = (): BreadcrumbItem => {
    if (query.data !== undefined) return { label: pullRequestLabel(query.data) };
    return { label: query.isError ? "Pull request unavailable" : "Loading pull request…" };
  };

  return (
    <RouteShell
      active="reviews"
      back={back}
      breadcrumbs={[
        { label: "Reviews", href: "/reviews" },
        pullRequestCrumb(),
        { label: "Diff", current: true },
      ]}
    >
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
                title="No fetched head"
                description={HEAD_UNREACHABLE}
                action={
                  <Button
                    size="sm"
                    loading={refresh.isPending}
                    onClick={() => refresh.mutate(pullRequest.id)}
                  >
                    Fetch from GitHub
                  </Button>
                }
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
    </RouteShell>
  );
}
