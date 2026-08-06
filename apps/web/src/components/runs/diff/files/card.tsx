import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { Button, Checkbox, DiffFileStatusChip, FOCUS_RING, useTheme } from "@otomat/ui";
import {
  diffFileDomId,
  extendDataFor,
  unrenderableNote,
} from "@web/components/runs/diff/files/card.utils";
import { diffLanguage } from "@web/components/runs/diff/files/language";
import { diffFileLabels } from "@web/components/runs/diff/files/path";
import { DiffStat } from "@web/components/runs/diff/stat";
import { useNearViewport } from "@web/components/runs/diff/use-near-viewport";
import type { DiffViewMode } from "@web/components/runs/diff/view-prefs";
import { ReviewCommentCard } from "@web/components/runs/review/comment-card";
import { ReviewCommentForm } from "@web/components/runs/review/comment-form";
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
  const viewport = useNearViewport();
  const data = useMemo(() => {
    const oldPath = file.old_path ?? file.path;
    return {
      oldFile: { fileName: oldPath, fileLang: diffLanguage(oldPath) },
      newFile: { fileName: file.path, fileLang: diffLanguage(file.path) },
      hunks: [file.patch],
    };
  }, [file.path, file.old_path, file.patch]);
  const extendData = useMemo(() => extendDataFor(commentsByLine), [commentsByLine]);

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
          diffViewHighlight={viewport.near}
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
      ref={viewport.ref}
      id={diffFileDomId(file)}
      tabIndex={-1}
      aria-label={file.path}
      className={`overflow-hidden rounded-md border border-border bg-surface-2 ${FOCUS_RING}`}
    >
      <header className="flex h-9 items-center gap-2.5 border-b border-border bg-surface-1 px-3.5 font-mono text-xs">
        <DiffFileStatusChip status={file.status} showLabel={false} />
        <span className="min-w-0 truncate">{diffFileLabels(file).full}</span>
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
