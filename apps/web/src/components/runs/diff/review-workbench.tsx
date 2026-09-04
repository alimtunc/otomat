import {
  BRANCH_DIFF_SCOPE,
  type ReviewDetail,
  type ReviewDiffContract,
  type ReviewTarget,
  type RunDiffScope,
  type RunDiffScopeSelector,
} from "@otomat/domain";
import {
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  useMediaQuery,
  usePanelGroupLayout,
  WIDE_VIEWPORT_MEDIA_QUERY,
} from "@otomat/ui";
import { useSelector } from "@tanstack/react-store";
import { useAddReviewComment } from "@web/api/reviews/mutations";
import { DiffFileCards } from "@web/components/runs/diff/cards";
import { DiffEmptyRegion } from "@web/components/runs/diff/empty-region";
import { DiffFileNav } from "@web/components/runs/diff/files/nav";
import { DiffFixBar } from "@web/components/runs/diff/fix-bar";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { DiffSearchField } from "@web/components/runs/diff/search/field";
import { DiffSidebar } from "@web/components/runs/diff/sidebar";
import { useDiffInteractions } from "@web/components/runs/diff/use-diff-interactions";
import type { DiffFileCommentActions } from "@web/components/runs/review/file-comments";
import type { ReactNode } from "react";

export interface ReviewWorkbenchProps {
  target: ReviewTarget;
  workspace: { open: boolean; issueId: string | null };
  scope?: RunDiffScopeSelector;
  answered: RunDiffScope;
  scopeControl?: ReactNode;
  diff: ReviewDiffContract;
  review: ReviewDetail;
  notice: ReactNode;
}

export function ReviewWorkbench({
  target,
  workspace,
  scope = BRANCH_DIFF_SCOPE,
  answered,
  scopeControl,
  diff,
  review,
  notice,
}: ReviewWorkbenchProps) {
  const addComment = useAddReviewComment(target);
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const filesLayout = usePanelGroupLayout("otomat.run-diff");
  const prefs = useSelector(diffPrefsStore);
  const interactions = useDiffInteractions({
    target,
    diff,
    comments: review.comments,
    reviewedFiles: review.reviewed_files,
    sort: prefs.sort,
    grouping: prefs.grouping,
    hideReviewed: prefs.hideReviewed,
  });
  const { partition, ordered, visible, reviewed, active, collapsed } = interactions;

  const commentActions: DiffFileCommentActions = {
    add: async (file, comment) => {
      await addComment.mutateAsync({ ...comment, file_path: file.path, diff_sha: file.sha });
    },
    reveal: interactions.selectComment,
  };
  const fileCommentsInput = {
    partition,
    destinations: review.destinations,
    preferredDestination: prefs.commentDestination,
  };

  const cards = (
    <DiffFileCards
      target={target}
      scope={scope}
      files={visible.files}
      hiddenCount={visible.hiddenCount}
      onShowHidden={() => diffPrefsStore.actions.set({ hideReviewed: false })}
      prefs={prefs}
      reviewedPaths={reviewed.paths}
      allReviewed={diff.files.length > 0 && reviewed.paths.size === diff.files.length}
      unsyncedMarks={reviewed.unsynced}
      onReviewedChange={interactions.toggleReviewed}
      onRetrySync={reviewed.retrySync}
      collapsed={collapsed}
      activePath={active.path}
      onActivate={active.select}
      comments={fileCommentsInput}
      commentActions={commentActions}
    />
  );

  const emptyRegion = (
    <DiffEmptyRegion target={target} scope={answered} detached={partition.detached} />
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
          additions={diff.additions}
          deletions={diff.deletions}
          files={ordered}
          browserMode={prefs.browser}
          grouping={prefs.grouping}
          stats={prefs.stats}
          activePath={active.path}
          reviewedPaths={reviewed.paths}
          onSelectFile={(file) => interactions.revealFile(file.path)}
          comments={review.comments}
          anchoredCommentIds={partition.anchoredIds}
          onSelectComment={interactions.selectComment}
        />
      </SidePanel>
      <ResizablePanel id="diff" minSize="40%">
        {cards}
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col">
      <DiffFileNav
        files={ordered}
        activePath={active.path}
        reviewedPaths={reviewed.paths}
        onSelect={(file) => interactions.revealFile(file.path)}
      />
      {cards}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {notice}
      <RunDiffHeader
        diff={diff}
        scopeControl={scopeControl}
        search={<DiffSearchField search={interactions.search} />}
        reviewStatus={review.review?.status ?? null}
        prefs={prefs}
        onPrefsChange={diffPrefsStore.actions.set}
        browsable={wide && diff.files.length > 0}
        reviewedCount={reviewed.paths.size}
        activePath={active.path}
      />
      {diff.files.length === 0 ? emptyRegion : browsedRegion}
      <DiffFixBar
        target={target}
        workspaceOpen={workspace.open}
        issueId={workspace.issueId}
        review={review}
      />
    </div>
  );
}
