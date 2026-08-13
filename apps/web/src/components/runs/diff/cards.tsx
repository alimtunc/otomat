import type { DiffFileContract } from "@otomat/domain";
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
  runId: string;
  files: readonly DiffFileContract[];
  hiddenCount: number;
  onShowHidden: () => void;
  prefs: DiffPrefs;
  reviewedPaths: ReadonlySet<string>;
  onReviewedChange: (path: string, reviewed: boolean) => void;
  collapsed: CollapsedFiles;
  activePath: string | null;
  onActivate: (path: string) => void;
  comments: FileCommentsInput;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCards({
  runId,
  files,
  hiddenCount,
  onShowHidden,
  prefs,
  reviewedPaths,
  onReviewedChange,
  collapsed,
  activePath,
  onActivate,
  comments,
  commentActions,
}: DiffFileCardsProps) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
      <div className="flex flex-col gap-3">
        {files.map((file) => (
          <DiffFileCard
            key={file.path}
            runId={runId}
            file={file}
            prefs={prefs}
            reviewed={reviewedPaths.has(file.path)}
            onReviewedChange={(next) => onReviewedChange(file.path, next)}
            collapsed={collapsed.has(file.path)}
            onCollapsedChange={(next) => collapsed.set(file.path, next)}
            active={file.path === activePath}
            onActivate={() => onActivate(file.path)}
            comments={fileComments(file.path, comments)}
            commentActions={commentActions}
          />
        ))}
        <HiddenReviewedNotice count={hiddenCount} onShow={onShowHidden} />
        <DetachedComments
          comments={comments.partition.detached}
          selectedIds={comments.selectedIds}
          onToggle={commentActions.toggle}
          onPublish={commentActions.publish}
          publishingId={comments.publishingId}
        />
      </div>
    </div>
  );
}
