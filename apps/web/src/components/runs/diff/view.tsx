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
import { DiffFileCards } from "@web/components/runs/diff/cards";
import { revealAndFocus } from "@web/components/runs/diff/diff-nav";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import { DiffFileNav } from "@web/components/runs/diff/files/nav";
import { DiffFixBar } from "@web/components/runs/diff/fix-bar";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { DiffSidebar } from "@web/components/runs/diff/sidebar";
import { useActiveDiffFile } from "@web/components/runs/diff/use-active-file";
import { useCollapsedFiles } from "@web/components/runs/diff/use-collapsed-files";
import { useDiffKeyboardNav } from "@web/components/runs/diff/use-diff-keyboard-nav";
import { useReviewedFiles } from "@web/components/runs/diff/use-reviewed-files";
import { hideReviewedFiles, sortDiffFiles } from "@web/components/runs/diff/visible-files";
import { reviewCommentDomId } from "@web/components/runs/review/comment/anchor";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import { partitionComments } from "@web/components/runs/review/partition";
import { useReviewSelection } from "@web/components/runs/review/use-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";

const NO_FILES: DiffFileContract[] = [];
const NO_COMMENTS: ReviewCommentContract[] = [];

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const navigate = useNavigate();
  const runQuery = useRunDetail(runId);
  const diffQuery = useRunDiff(runId);
  const reviewQuery = useRunReview(runId);
  const addComment = useAddReviewComment(runId);
  const selection = useReviewSelection(runId);
  const active = useActiveDiffFile(runId);
  const collapsed = useCollapsedFiles();
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const filesLayout = usePanelGroupLayout("otomat.run-diff");
  const prefs = useSelector(diffPrefsStore);
  const diff = diffQuery.data?.diff ?? null;
  const files = diff?.files ?? NO_FILES;
  const reviewed = useReviewedFiles(runId, files);
  const ordered = sortDiffFiles(files, prefs.sort);
  const partition = partitionComments(diff, reviewQuery.data?.comments ?? NO_COMMENTS);
  const visible = hideReviewedFiles(ordered, {
    hideReviewed: prefs.hideReviewed,
    reviewedPaths: reviewed.paths,
    commentedPaths: partition.commentedPaths,
  });

  const revealFile = (path: string): void => {
    active.select(path);
    collapsed.set(path, false);
    const card = document.getElementById(diffFileDomId({ path }));
    if (card !== null) revealAndFocus(card, "start");
  };

  const toggleReviewed = (path: string, next: boolean): void => {
    reviewed.setReviewed(path, next);
    collapsed.set(path, next);
  };

  useDiffKeyboardNav({
    enabled: ordered.length > 0,
    files: visible.files,
    activePath: active.path,
    onJumpToFile: (file) => revealFile(file.path),
    onToggleReviewed: (path) => toggleReviewed(path, !reviewed.paths.has(path)),
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

  const review = reviewQuery.data;

  const selectComment = (comment: ReviewCommentContract): void => {
    if (partition.anchoredIds.has(comment.id)) {
      active.select(comment.file_path);
      collapsed.set(comment.file_path, false);
    }
    // The anchor only exists once the card it lives in has rendered expanded.
    requestAnimationFrame(() => {
      const target = document.getElementById(reviewCommentDomId(comment.id));
      if (target !== null) revealAndFocus(target, "center");
    });
  };

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

  const submitComment = async (
    filePath: string,
    diffSha: string,
    line: number | null,
    body: string,
  ): Promise<void> => {
    await addComment.mutateAsync({ file_path: filePath, diff_sha: diffSha, line, body });
  };

  const cards = (
    <DiffFileCards
      runId={runId}
      files={visible.files}
      hiddenCount={visible.hiddenCount}
      onShowHidden={() => diffPrefsStore.actions.set({ hideReviewed: false })}
      prefs={prefs}
      reviewedPaths={reviewed.paths}
      onReviewedChange={toggleReviewed}
      collapsed={collapsed}
      activePath={active.path}
      onActivate={active.select}
      comments={partition}
      selection={selection}
      onAddComment={(file, line, body) => submitComment(file.path, file.sha, line, body)}
    />
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
      {partition.detached.length > 0 ? (
        <div className="p-4">
          <DetachedComments comments={partition.detached} selection={selection} />
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
        <DiffSidebar
          diff={diff}
          browserMode={prefs.browser}
          stats={prefs.stats}
          activePath={active.path}
          reviewedPaths={reviewed.paths}
          onSelectFile={(file) => revealFile(file.path)}
          comments={review.comments}
          anchoredCommentIds={partition.anchoredIds}
          onSelectComment={selectComment}
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
        activePath={active.path}
        reviewedPaths={reviewed.paths}
        onSelect={(file) => revealFile(file.path)}
      />
      {cards}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunDiffHeader
        diff={diff}
        reviewStatus={review.review?.status ?? null}
        prefs={prefs}
        onPrefsChange={diffPrefsStore.actions.set}
        browsable={wide && diff.files.length > 0}
        reviewedCount={diff.files.filter((file) => reviewed.paths.has(file.path)).length}
        activePath={active.path}
      />
      {diff.files.length === 0 ? emptyRegion : browsedRegion}
      <DiffFixBar
        workspaceOpen={runQuery.data?.holds_workspace === true}
        authority={review.fix_authority}
        selection={selection}
      />
    </div>
  );
}
