import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { Button, Checkbox, DiffFileStatusChip, useTheme } from "@otomat/ui";
import {
  diffFileDomId,
  extendDataFor,
  unrenderableNote,
} from "@web/components/runs/diff/file-card.utils";
import { DiffStat } from "@web/components/runs/diff/stat";
import type { DiffViewMode } from "@web/components/runs/diff/view-prefs";
import { ReviewCommentCard } from "@web/components/runs/review/comment-card";
import { ReviewCommentForm } from "@web/components/runs/review/comment-form";
import { FOCUS_RING } from "@web/lib/focus";
import { useMemo } from "react";

export interface DiffFileCardProps {
  file: DiffFileContract;
  mode: DiffViewMode;
  reviewed: boolean;
  onReviewedChange: (reviewed: boolean) => void;
  commentsByLine: Map<number, ReviewCommentContract[]>;
  onAddComment: (line: number, body: string) => Promise<void>;
  selectedCommentIds: ReadonlySet<string>;
  onToggleComment: (commentId: string, selected: boolean) => void;
}

export function DiffFileCard({
  file,
  mode,
  reviewed,
  onReviewedChange,
  commentsByLine,
  onAddComment,
  selectedCommentIds,
  onToggleComment,
}: DiffFileCardProps) {
  const { theme } = useTheme();
  const data = useMemo(
    () => ({
      oldFile: { fileName: file.old_path ?? file.path },
      newFile: { fileName: file.path },
      hunks: [file.patch],
    }),
    [file.path, file.old_path, file.patch],
  );
  const extendData = useMemo(() => extendDataFor(commentsByLine), [commentsByLine]);

  const renamedFrom = file.old_path !== null && file.old_path !== file.path ? file.old_path : null;
  const note = unrenderableNote(file);

  const cardBody =
    note !== null ? (
      <p className="px-3 py-4 text-sm text-text-tertiary">{note}</p>
    ) : (
      <div className="otomat-review-diff">
        <DiffView<ReviewCommentContract[]>
          data={data}
          extendData={extendData}
          diffViewMode={mode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified}
          diffViewTheme={theme}
          diffViewHighlight={false}
          diffViewFontSize={12}
          diffViewAddWidget
          renderWidgetLine={({ side, lineNumber, onClose }) =>
            side === SplitSide.new ? (
              <ReviewCommentForm
                filePath={file.path}
                line={lineNumber}
                onSubmit={(body) => onAddComment(lineNumber, body)}
                onClose={onClose}
              />
            ) : (
              <div className="flex items-center gap-2 border-y border-border bg-surface-2 p-3 text-xs text-text-tertiary">
                Comments pin to the new side of the diff.
                <Button variant="ghost" size="xs" onClick={onClose}>
                  Close
                </Button>
              </div>
            )
          }
          renderExtendLine={({ data: comments }) => (
            <div className="flex flex-col gap-2 border-y border-border bg-surface-1 p-3">
              {comments.map((comment) => (
                <ReviewCommentCard
                  key={comment.id}
                  comment={comment}
                  selected={selectedCommentIds.has(comment.id)}
                  onSelectedChange={(selected) => onToggleComment(comment.id, selected)}
                />
              ))}
            </div>
          )}
        />
      </div>
    );

  return (
    <section
      id={diffFileDomId(file)}
      tabIndex={-1}
      aria-label={file.path}
      className={`overflow-hidden rounded-md border border-border bg-surface-2 ${FOCUS_RING}`}
    >
      <header className="flex h-9 items-center gap-2.5 border-b border-border bg-surface-1 px-3.5 font-mono text-xs">
        <DiffFileStatusChip status={file.status} showLabel={false} />
        <span className="min-w-0 truncate">
          {renamedFrom ? `${renamedFrom} → ${file.path}` : file.path}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <DiffStat additions={file.additions} deletions={file.deletions} />
          <label className="flex cursor-pointer select-none items-center gap-1.5 font-sans text-xs text-text-secondary">
            <Checkbox
              checked={reviewed}
              onCheckedChange={(checked) => onReviewedChange(checked === true)}
            />
            Reviewed
          </label>
        </span>
      </header>
      {reviewed ? null : cardBody}
    </section>
  );
}
