import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { EmptyState, ErrorState, useMediaQuery } from "@otomat/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useAddReviewComment } from "@web/api/reviews/mutations";
import { useRunReview } from "@web/api/reviews/queries";
import { useRunDetail, useRunDiff } from "@web/api/runs/queries";
import { DiffFileCard } from "@web/components/runs/diff/file-card";
import { diffFileDomId } from "@web/components/runs/diff/file-card.utils";
import { DiffFileNav } from "@web/components/runs/diff/file-nav";
import { DiffFileTree } from "@web/components/runs/diff/file-tree";
import { DiffFixBar } from "@web/components/runs/diff/fix-bar";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { useReviewedFiles } from "@web/components/runs/diff/use-reviewed-files";
import { diffViewModeStore } from "@web/components/runs/diff/view-prefs-store";
import { ArchivedComments } from "@web/components/runs/review/archived-comments";
import { partitionComments } from "@web/components/runs/review/partition";
import { useReviewSelection } from "@web/components/runs/review/use-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { WIDE_COCKPIT_MEDIA_QUERY } from "@web/lib/layout";
import { useRef, useState } from "react";

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const navigate = useNavigate();
  const runQuery = useRunDetail(runId);
  const diffQuery = useRunDiff(runId);
  const reviewQuery = useRunReview(runId);
  const addComment = useAddReviewComment(runId);
  const selection = useReviewSelection(runId);
  const [activePath, setActivePath] = useState<string | null>(null);
  const wide = useMediaQuery(WIDE_COCKPIT_MEDIA_QUERY);
  const mode = useSelector(diffViewModeStore);
  const diff = diffQuery.data?.diff ?? null;
  const reviewed = useReviewedFiles(runId, diff?.sha ?? "");
  const cardsRef = useRef<HTMLDivElement | null>(null);

  function jumpToFile(file: DiffFileContract) {
    setActivePath(file.path);
    const card = document.getElementById(diffFileDomId(file));
    card?.scrollIntoView({ block: "start" });
    card?.focus({ preventScroll: true });
  }

  useDiffKeyboardNav({
    enabled: diff !== null && diff.files.length > 0,
    files: diff?.files ?? [],
    activePath,
    cardsRef,
    onJumpToFile: jumpToFile,
    onToggleReviewed: (path) => reviewed.setReviewed(path, !reviewed.paths.has(path)),
    onExit: () => void navigate({ to: "/runs/$runId", params: { runId } }),
  });

  if (diffQuery.isPending || reviewQuery.isPending) return <DetailSkeleton blocks={2} />;
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

  const cards = (
    <div ref={cardsRef} className="min-w-0 overflow-auto p-4">
      <div className="flex flex-col gap-3">
        {diff.files.map((file) => (
          <DiffFileCard
            key={file.path}
            file={file}
            mode={mode}
            reviewed={reviewed.paths.has(file.path)}
            onReviewedChange={(next) => reviewed.setReviewed(file.path, next)}
            commentsByLine={anchored.get(file.path) ?? new Map<number, ReviewCommentContract[]>()}
            onAddComment={(line, body) => submitComment(file.path, file.sha, line, body)}
            selectedCommentIds={selection.selectedIds}
            onToggleComment={selection.toggle}
          />
        ))}
        <ArchivedComments comments={archived} selection={selection} />
      </div>
    </div>
  );

  let filesRegion;
  if (diff.files.length === 0) {
    filesRegion = (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <CenteredState fill="flex">
          <EmptyState
            icon="git-compare"
            title="No changes yet"
            description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
          />
        </CenteredState>
        {archived.length > 0 ? (
          <div className="p-4">
            <ArchivedComments comments={archived} selection={selection} />
          </div>
        ) : null}
      </div>
    );
  } else if (wide) {
    filesRegion = (
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr]">
        <DiffFileTree
          diff={diff}
          activePath={activePath}
          reviewedPaths={reviewed.paths}
          onSelect={jumpToFile}
        />
        {cards}
      </div>
    );
  } else {
    filesRegion = (
      <div className="flex min-h-0 flex-1 flex-col">
        <DiffFileNav
          diff={diff}
          activePath={activePath}
          reviewedPaths={reviewed.paths}
          onSelect={jumpToFile}
        />
        {cards}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunDiffHeader
        diff={diff}
        reviewStatus={reviewQuery.data.review?.status ?? null}
        mode={mode}
        onModeChange={diffViewModeStore.actions.set}
        reviewedCount={diff.files.filter((file) => reviewed.paths.has(file.path)).length}
      />
      {filesRegion}
      <DiffFixBar runStatus={runQuery.data?.run.status} selection={selection} />
    </div>
  );
}
