import type { ReviewCommentContract } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useAddReviewComment } from "@web/api/reviews/mutations";
import { useRunDiff, useRunReview } from "@web/api/reviews/queries";
import { useRunDetail } from "@web/api/runs/queries";
import { DiffFileCard } from "@web/components/runs/diff/file-card";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { ArchivedComments } from "@web/components/runs/review/archived-comments";
import { partitionComments } from "@web/components/runs/review/partition";
import { useReviewSelection } from "@web/components/runs/review/use-selection";
import { CenteredState } from "@web/components/shell/centered-state";

function DiffLoading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const runQuery = useRunDetail(runId);
  const diffQuery = useRunDiff(runId);
  const reviewQuery = useRunReview(runId);
  const addComment = useAddReviewComment(runId);
  const selection = useReviewSelection(runId);

  if (diffQuery.isPending || reviewQuery.isPending) return <DiffLoading />;
  if (diffQuery.isError || reviewQuery.isError) {
    return (
      <CenteredState>
        <ErrorState
          title="Could not load the diff"
          description="The daemon did not answer or the git diff failed. Check the daemon logs."
          onRetry={() => {
            void diffQuery.refetch();
            void reviewQuery.refetch();
          }}
        />
      </CenteredState>
    );
  }

  const diff = diffQuery.data.diff;
  const { anchored, archived } = partitionComments(diff, reviewQuery.data.comments);

  if (diff === null) {
    return (
      <CenteredState>
        <EmptyState
          icon="git-compare"
          title="No worktree for this run"
          description="This run executed without a git worktree, so there is no diff to show. Diffs are never fabricated."
        />
      </CenteredState>
    );
  }

  async function submitComment(filePath: string, diffSha: string, line: number, body: string) {
    await addComment.mutateAsync({ file_path: filePath, diff_sha: diffSha, line, body });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <RunDiffHeader
        diff={diff}
        reviewStatus={reviewQuery.data.review?.status ?? null}
        runStatus={runQuery.data?.run.status}
        selection={selection}
      />

      {diff.files.length === 0 ? (
        <CenteredState fill="flex">
          <EmptyState
            icon="git-compare"
            title="No changes yet"
            description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
          />
        </CenteredState>
      ) : (
        <div className="flex flex-col gap-3">
          {diff.files.map((file) => (
            <DiffFileCard
              key={file.path}
              file={file}
              commentsByLine={anchored.get(file.path) ?? new Map<number, ReviewCommentContract[]>()}
              onAddComment={(line, body) => submitComment(file.path, file.sha, line, body)}
              selectedCommentIds={selection.selectedIds}
              onToggleComment={selection.toggle}
            />
          ))}
        </div>
      )}

      <ArchivedComments comments={archived} selection={selection} />
    </div>
  );
}
