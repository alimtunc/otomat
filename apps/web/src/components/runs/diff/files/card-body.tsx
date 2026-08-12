import { DiffModeEnum, DiffView, SplitSide, type DiffFile } from "@git-diff-view/react";
import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";
import { Button, useTheme } from "@otomat/ui";
import { extendDataFor, unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import { diffLanguage } from "@web/components/runs/diff/files/language";
import type { FileBlobsContext } from "@web/components/runs/diff/files/use-file-blobs";
import type { DiffViewMode } from "@web/components/runs/diff/prefs/prefs";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { ReviewCommentForm } from "@web/components/runs/review/comment/form";
import { useCallback, useEffect, useMemo, useRef } from "react";

interface DiffViewHandle {
  getDiffFileInstance: () => DiffFile | null;
}

export interface DiffFileCardBodyProps {
  file: DiffFileContract;
  mode: DiffViewMode;
  wrap: boolean;
  highlight: boolean;
  context: FileBlobsContext | null;
  expandAll: boolean;
  commentsByLine: Map<number, ReviewCommentContract[]>;
  onAddComment: (line: number, body: string) => Promise<void>;
  selectedCommentIds: ReadonlySet<string>;
  onToggleComment: (commentId: string, selected: boolean) => void;
}

export function DiffFileCardBody({
  file,
  mode,
  wrap,
  highlight,
  context,
  expandAll,
  commentsByLine,
  onAddComment,
  selectedCommentIds,
  onToggleComment,
}: DiffFileCardBodyProps) {
  const { theme } = useTheme();
  const handle = useRef<DiffViewHandle | null>(null);
  const attach = useCallback((instance: DiffViewHandle | null) => {
    handle.current = instance;
  }, []);

  const data = useMemo(() => {
    const oldPath = file.old_path ?? file.path;
    return {
      oldFile: {
        fileName: oldPath,
        fileLang: diffLanguage(oldPath),
        content: context?.base ?? null,
      },
      newFile: {
        fileName: file.path,
        fileLang: diffLanguage(file.path),
        content: context?.head ?? null,
      },
      hunks: [file.patch],
    };
  }, [file.path, file.old_path, file.patch, context]);
  const extendData = useMemo(() => extendDataFor(commentsByLine), [commentsByLine]);

  // otomat-allow-effect: expansion lives only on @git-diff-view's imperative instance.
  useEffect(() => {
    if (!expandAll || context === null) return;
    handle.current?.getDiffFileInstance()?.onAllExpand(mode);
  }, [expandAll, context, mode]);

  const note = unrenderableNote(file);
  if (note !== null) return <p className="px-3 py-4 text-sm text-text-tertiary">{note}</p>;

  return (
    <div className="otomat-review-diff overflow-hidden rounded-b-md">
      <DiffView<ReviewCommentContract[]>
        ref={attach}
        data={data}
        extendData={extendData}
        diffViewMode={mode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified}
        diffViewTheme={theme}
        diffViewHighlight={highlight}
        diffViewWrap={wrap}
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
}
