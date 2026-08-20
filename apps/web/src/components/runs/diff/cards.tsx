import type {
  DiffFileContract,
  ReviewedFileContract,
  ReviewTarget,
  RunDiffScopeSelector,
} from "@otomat/domain";
import { DiffAllReviewedNotice } from "@web/components/runs/diff/all-reviewed-notice";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { HiddenReviewedNotice } from "@web/components/runs/diff/hidden-notice";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import type { CollapsedFiles } from "@web/components/runs/diff/use-collapsed-files";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import {
  fileComments,
  type DiffFileCommentActions,
  type FileCommentsInput,
} from "@web/components/runs/review/file-comments";

export interface DiffFileCardsProps {
  target: ReviewTarget;
  scope: RunDiffScopeSelector;
  files: readonly DiffFileContract[];
  hiddenCount: number;
  onShowHidden: () => void;
  prefs: DiffPrefs;
  reviewedPaths: ReadonlySet<string>;
  /** True once every file of the diff carries a Reviewed mark, hidden ones included. */
  allReviewed: boolean;
  unsyncedMarks: ReadonlyMap<string, ReviewedFileContract>;
  onReviewedChange: (path: string, reviewed: boolean) => void;
  onRetrySync: (path: string) => void;
  collapsed: CollapsedFiles;
  activePath: string | null;
  onActivate: (path: string) => void;
  comments: FileCommentsInput;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCards({
  target,
  scope,
  files,
  hiddenCount,
  onShowHidden,
  prefs,
  reviewedPaths,
  allReviewed,
  unsyncedMarks,
  onReviewedChange,
  onRetrySync,
  collapsed,
  activePath,
  onActivate,
  comments,
  commentActions,
}: DiffFileCardsProps) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      {files.map((file) => (
        <DiffFileCard
          key={file.path}
          target={target}
          scope={scope}
          file={file}
          prefs={prefs}
          reviewed={reviewedPaths.has(file.path)}
          onReviewedChange={(next) => onReviewedChange(file.path, next)}
          unsyncedMark={unsyncedMarks.get(file.path) ?? null}
          onRetrySync={() => onRetrySync(file.path)}
          collapsed={collapsed.has(file.path)}
          onCollapsedChange={(next) => collapsed.set(file.path, next)}
          active={file.path === activePath}
          onActivate={() => onActivate(file.path)}
          comments={fileComments(file.path, comments)}
          commentActions={commentActions}
        />
      ))}
      <HiddenReviewedNotice count={hiddenCount} onShow={onShowHidden} />
      {allReviewed ? <DiffAllReviewedNotice count={reviewedPaths.size} /> : null}
      <DetachedComments
        target={target}
        comments={comments.partition.detached}
        selectedIds={comments.selectedIds}
        onToggle={commentActions.toggle}
        onPublish={commentActions.publish}
        publishingId={comments.publishingId}
      />
    </div>
  );
}
