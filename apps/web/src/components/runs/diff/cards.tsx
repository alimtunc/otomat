import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { HiddenReviewedNotice } from "@web/components/runs/diff/hidden-notice";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import type { CollapsedFiles } from "@web/components/runs/diff/use-collapsed-files";
import { DetachedComments } from "@web/components/runs/review/detached-comments";
import type { PartitionedComments } from "@web/components/runs/review/partition";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

const NO_LINE_COMMENTS = new Map<number, ReviewCommentContract[]>();
const NO_FILE_COMMENTS: ReviewCommentContract[] = [];

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
  comments: PartitionedComments;
  selection: ReviewSelection;
  onAddComment: (file: DiffFileContract, line: number | null, body: string) => Promise<void>;
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
  selection,
  onAddComment,
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
            commentsByLine={comments.byLine.get(file.path) ?? NO_LINE_COMMENTS}
            fileComments={comments.byFile.get(file.path) ?? NO_FILE_COMMENTS}
            onAddComment={(line, body) => onAddComment(file, line, body)}
            selectedCommentIds={selection.selectedIds}
            onToggleComment={selection.toggle}
          />
        ))}
        <HiddenReviewedNotice count={hiddenCount} onShow={onShowHidden} />
        <DetachedComments comments={comments.detached} selection={selection} />
      </div>
    </div>
  );
}
