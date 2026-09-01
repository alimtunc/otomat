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
import { useAddReviewComment, usePublishReviewComment } from "@web/api/reviews/mutations";
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
  const publishComment = usePublishReviewComment(target);
  const wide = useMediaQuery(WIDE_VIEWPORT_MEDIA_QUERY);
  const filesLayout = usePanelGroupLayout("otomat.run-diff");
  const prefs = useSelector(diffPrefsStore);
  const interactions = useDiffInteractions({
    target,
    diff,
    comments: review.comments,
    reviewedFiles: review.reviewed_files,
    sort: prefs.sort,
    hideReviewed: prefs.hideReviewed,
  });
  const { partition, visible, reviewed, active, collapsed } = interactions;

  const commentActions: DiffFileCommentActions = {
    add: async (file, comment) => {
      await addComment.mutateAsync({ ...comment, file_path: file.path, diff_sha: file.sha });
    },
    publish: (commentId) => publishComment.mutate(commentId),
    reveal: interactions.selectComment,
  };
  const fileCommentsInput = {
    partition,
    destinations: review.destinations,
    preferredDestination: prefs.commentDestination,
    publishingId: publishComment.isPending ? publishComment.variables : null,
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
    <DiffEmptyRegion
      target={target}
      scope={answered}
      detached={partition.detached}
      onPublish={commentActions.publish}
      publishingId={fileCommentsInput.publishingId}
    />
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
        diff={diff}
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
        runId={target.id}
        workspaceOpen={workspace.open}
        issueId={workspace.issueId}
        authority={review.fix_authority}
        comments={review.comments}
      />
    </div>
  );
}
