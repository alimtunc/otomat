import {
  DiffModeEnum,
  DiffViewWithMultiSelect,
  SplitSide,
  type DiffViewWithMultiSelectRef,
} from "@git-diff-view/react";
import type { DiffFileContract, DiffSide, ReviewCommentContract } from "@otomat/domain";
import { useTheme } from "@otomat/ui";
import { extendDataFor, unrenderableNote } from "@web/components/runs/diff/files/card.utils";
import { diffLanguage } from "@web/components/runs/diff/files/language";
import type { FileBlobsContext } from "@web/components/runs/diff/files/use-file-blobs";
import { useGutterRange } from "@web/components/runs/diff/files/use-gutter-range";
import type { DiffViewMode } from "@web/components/runs/diff/prefs/prefs";
import { ReviewCommentCard } from "@web/components/runs/review/comment/card";
import { ReviewCommentComposer } from "@web/components/runs/review/comment/composer";
import type {
  DiffFileCommentActions,
  DiffFileComments,
} from "@web/components/runs/review/file-comments";
import { useEffect, useMemo, useRef } from "react";

function diffSide(side: SplitSide): DiffSide {
  return side === SplitSide.old ? "old" : "new";
}

export interface DiffFileCardBodyProps {
  file: DiffFileContract;
  mode: DiffViewMode;
  wrap: boolean;
  highlight: boolean;
  context: FileBlobsContext | null;
  expandAll: boolean;
  comments: DiffFileComments;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCardBody({
  file,
  mode,
  wrap,
  highlight,
  context,
  expandAll,
  comments,
  commentActions,
}: DiffFileCardBodyProps) {
  const { theme } = useTheme();
  const view = useRef<DiffViewWithMultiSelectRef | null>(null);
  const gutter = useGutterRange(view, mode, wrap);

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
  const extendData = useMemo(() => extendDataFor(comments.byLine), [comments.byLine]);

  // otomat-allow-effect: expansion lives only on @git-diff-view's imperative instance.
  useEffect(() => {
    if (!expandAll || context === null) return;
    view.current?.getDiffFileInstance()?.onAllExpand(mode);
  }, [expandAll, context, mode]);

  const note = unrenderableNote(file);
  if (note !== null) return <p className="px-3 py-4 text-sm text-text-tertiary">{note}</p>;

  return (
    <div
      className="otomat-review-diff overflow-hidden rounded-b-md"
      onMouseDownCapture={gutter.press}
    >
      <DiffViewWithMultiSelect<ReviewCommentContract[]>
        ref={view}
        data={data}
        extendData={extendData}
        diffViewMode={mode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified}
        diffViewTheme={theme}
        diffViewHighlight={highlight}
        diffViewWrap={wrap}
        diffViewFontSize={12}
        diffViewAddWidget
        onCreateUseWidgetHook={gutter.attachWidget}
        onMultiSelectComplete={({ range }) =>
          gutter.select({
            side: range.side,
            start: range.startLineNumber,
            end: range.endLineNumber,
          })
        }
        onAddWidgetClick={({ lineNumber, fromLineNumber, side }) =>
          gutter.select({
            side: diffSide(side),
            start: fromLineNumber ?? lineNumber,
            end: lineNumber,
          })
        }
        renderWidgetLine={({ side, lineNumber, onClose }) => {
          const anchor = gutter.rangeAt(diffSide(side), lineNumber);
          return (
            <ReviewCommentComposer
              file={file}
              side={diffSide(side)}
              line={anchor.end}
              fromLine={anchor.start}
              destinations={comments.destinations}
              preferredDestination={comments.preferredDestination}
              onMoveEdge={gutter.moveEdge}
              onSubmit={(comment) => commentActions.add(file, comment)}
              onClose={() => {
                gutter.close();
                onClose();
              }}
            />
          );
        }}
        renderExtendLine={({ data: onLine }) => (
          <div className="flex flex-col gap-2 border-y border-border bg-surface-1 p-3">
            {onLine.map((comment) => (
              <ReviewCommentCard
                key={comment.id}
                comment={comment}
                selected={comments.selectedIds.has(comment.id)}
                onSelectedChange={(selected) => commentActions.toggle(comment.id, selected)}
                onPublish={() => commentActions.publish(comment.id)}
                publishing={comments.publishingId === comment.id}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
}
