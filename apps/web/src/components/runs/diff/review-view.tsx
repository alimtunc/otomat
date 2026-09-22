import type { ReviewDiffContract, RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import { cn, EmptyState, ErrorState, STALE_CONTENT_CLASS } from "@otomat/ui";
import { useReviewDetail, useReviewDiff } from "@web/api/reviews/queries";
import {
  ReviewWorkbench,
  type ReviewWorkbenchProps,
} from "@web/components/runs/diff/review-workbench";
import { DiffScopeUnavailable } from "@web/components/runs/diff/scope/unavailable";
import { CenteredState } from "@web/components/shell/centered-state";
import { SplitSkeleton } from "@web/components/shell/split-skeleton";
import { StaleNotice } from "@web/components/shell/stale-notice";
import type { ReactNode } from "react";

export interface ReviewDiffViewProps {
  target: ReviewWorkbenchProps["target"];
  workspace: ReviewWorkbenchProps["workspace"];
  emptyDescription: string;
  scope?: RunDiffScopeSelector;
  scopeControl?: (scope: RunDiffScope, diff: ReviewDiffContract | null) => ReactNode;
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

  if (diffQuery.isPending || reviewQuery.isPending) return <SplitSkeleton side={264} />;
  const retained = diffQuery.isPlaceholderData;
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
  const diff = diffQuery.data.diff;
  const control = scopeControl?.(answered, diff);
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
    <div inert={retained} className={cn("h-full", retained && STALE_CONTENT_CLASS)}>
      <ReviewWorkbench
        target={target}
        workspace={workspace}
        scope={diffQuery.data.requested}
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
    </div>
  );
}
