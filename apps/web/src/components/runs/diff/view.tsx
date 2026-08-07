import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useAddReviewComment } from "@web/api/reviews/mutations";
import { useRunReview } from "@web/api/reviews/queries";
import { useRunDetail, useRunDiff } from "@web/api/runs/queries";
import { revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { DiffFileBrowser } from "@web/components/runs/diff/files/browser";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import { DiffFileNav } from "@web/components/runs/diff/files/nav";
import { DiffFixBar } from "@web/components/runs/diff/fix-bar";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { useReviewedFiles } from "@web/components/runs/diff/use-reviewed-files";
import {
  diffBrowserModeStore,
  diffViewModeStore,
} from "@web/components/runs/diff/view-prefs-store";
import { ArchivedComments } from "@web/components/runs/review/archived-comments";
import { partitionComments } from "@web/components/runs/review/partition";
import { useReviewSelection } from "@web/components/runs/review/use-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { useState } from "react";

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const navigate = useNavigate();
  const runQuery = useRunDetail(runId);
  const diffQuery = useRunDiff(runId);
  const reviewQuery = useRunReview(runId);
  const addComment = useAddReviewComment(runId);
  const selection = useReviewSelection(runId);
  const [activePath, setActivePath] = useState<string | null>(null);
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const filesLayout = usePanelGroupLayout("otomat.run-diff");
  const mode = useSelector(diffViewModeStore);
  const browserMode = useSelector(diffBrowserModeStore);
  const diff = diffQuery.data?.diff ?? null;
  const reviewed = useReviewedFiles(runId, diff?.sha ?? "");

  function jumpToFile(file: DiffFileContract) {
    setActivePath(file.path);
    const card = document.getElementById(diffFileDomId(file));
    if (card !== null) revealAndFocus(card, "start");
  }

  useDiffKeyboardNav({
    enabled: diff !== null && diff.files.length > 0,
    files: diff?.files ?? [],
    activePath,
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
    <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
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

  const emptyRegion = (
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

  const browsedRegion = wide ? (
    <ResizablePanelGroup {...filesLayout} className="min-h-0 flex-1">
      <SidePanel
        id="diff-files"
        label="Changed files"
        side="left"
        defaultSize={264}
        minSize={168}
        maxSize="40%"
      >
        <DiffFileBrowser
          diff={diff}
          mode={browserMode}
          activePath={activePath}
          reviewedPaths={reviewed.paths}
          onSelect={jumpToFile}
        />
      </SidePanel>
      <ResizablePanel id="diff" minSize="40%">
        {cards}
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunDiffHeader
        diff={diff}
        reviewStatus={reviewQuery.data.review?.status ?? null}
        mode={mode}
        onModeChange={diffViewModeStore.actions.set}
        browserMode={wide && diff.files.length > 0 ? browserMode : null}
        onBrowserModeChange={diffBrowserModeStore.actions.set}
        reviewedCount={diff.files.filter((file) => reviewed.paths.has(file.path)).length}
      />
      {diff.files.length === 0 ? emptyRegion : browsedRegion}
      <DiffFixBar runStatus={runQuery.data?.run.status} selection={selection} />
    </div>
  );
}
