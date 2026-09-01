import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import { EmptyState, ErrorState } from "@otomat/ui";
import { useReviewDetail, useReviewDiff } from "@web/api/reviews/queries";
import {
  ReviewWorkbench,
  type ReviewWorkbenchProps,
} from "@web/components/runs/diff/review-workbench";
import { DiffScopeUnavailable } from "@web/components/runs/diff/scope/unavailable";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { StaleNotice } from "@web/components/shell/stale-notice";
import type { ReactNode } from "react";

export interface ReviewDiffViewProps {
  target: ReviewWorkbenchProps["target"];
  workspace: ReviewWorkbenchProps["workspace"];
  emptyDescription: string;
  scope?: RunDiffScopeSelector;
  scopeControl?: (scope: RunDiffScope) => ReactNode;
}

export function ReviewDiffView({
  target,
  workspace,
  emptyDescription,
  scope,
  scopeControl,
}: ReviewDiffViewProps) {
  const diffQuery = useReviewDiff(target, scope);
  const reviewQuery = useReviewDetail(target);

  const retryBoth = (): void => {
    void diffQuery.refetch();
    void reviewQuery.refetch();
  };

  if (diffQuery.isPending || reviewQuery.isPending) return <DetailSkeleton blocks={2} />;
  const review = reviewQuery.data;
  // Two queries share this view, so QueryBoundary's ladder is applied by hand: block only when a failing query has nothing retained.
  if (diffQuery.data === undefined || review === undefined) {
    return (
      <CenteredState>
        <ErrorState
          title="Could not load the diff"
          description="The daemon did not answer or the git diff failed. Check the daemon logs."
          onRetry={retryBoth}
        />
      </CenteredState>
    );
  }

  const answered = diffQuery.data.scope;
  const control = scopeControl?.(answered);
  const diff = diffQuery.data.diff;
  if (diff === null) {
    return control === undefined ? (
      <CenteredState>
        <EmptyState icon="git-compare" title="No diff to review" description={emptyDescription} />
      </CenteredState>
    ) : (
      <DiffScopeUnavailable scopeControl={control} reason={diffQuery.data.unavailable} />
    );
  }

  const refreshFailed = diffQuery.isError || reviewQuery.isError;
  return (
    <ReviewWorkbench
      target={target}
      workspace={workspace}
      scope={scope}
      answered={answered}
      scopeControl={control}
      diff={diff}
      review={review}
      notice={
        refreshFailed ? (
          <StaleNotice
            dataUpdatedAt={Math.min(diffQuery.dataUpdatedAt, reviewQuery.dataUpdatedAt)}
            refreshing={diffQuery.isFetching || reviewQuery.isFetching}
            onRetry={retryBoth}
          />
        ) : null
      }
    />
  );
}
