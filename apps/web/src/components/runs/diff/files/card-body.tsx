import {
  DiffModeEnum,
  DiffViewWithMultiSelect,
  SplitSide,
  type DiffViewWithMultiSelectRef,
} from "@git-diff-view/react";
import type {
  DiffFileContract,
  DiffSide,
  ReviewCommentContract,
  ReviewTarget,
} from "@otomat/domain";
import { useTheme } from "@otomat/ui";
import {
  diffViewData,
  extendDataFor,
  unrenderableNote,
} from "@web/components/runs/diff/files/card.utils";
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
  target: ReviewTarget;
  file: DiffFileContract;
  mode: DiffViewMode;
  wrap: boolean;
  highlight: boolean;
  context: FileBlobsContext | null;
  fullFile: boolean;
  comments: DiffFileComments;
  commentActions: DiffFileCommentActions;
}

export function DiffFileCardBody({
  target,
  file,
  mode,
  wrap,
  highlight,
  context,
  fullFile,
  comments,
  commentActions,
}: DiffFileCardBodyProps) {
  const { theme } = useTheme();
  const view = useRef<DiffViewWithMultiSelectRef | null>(null);
  const gutter = useGutterRange(view, mode, wrap);

  const data = useMemo(
    () => diffViewData(file, file.patch, context),
    [file.path, file.old_path, file.patch, context],
  );
  const extendData = useMemo(() => extendDataFor(comments.byLine), [comments.byLine]);

  // otomat-allow-effect: expansion lives only on @git-diff-view's imperative instance.
  useEffect(() => {
    if (context === null) return;
    const instance = view.current?.getDiffFileInstance() ?? null;
    if (instance === null) return;
    // Reading it back keeps a hand-expanded hunk from being folded by an unrelated render.
    const expanded = mode === "split" ? instance.hasExpandSplitAll : instance.hasExpandUnifiedAll;
    if (expanded === fullFile) return;
    if (fullFile) instance.onAllExpand(mode);
    else instance.onAllCollapse(mode);
  }, [fullFile, context, mode]);

  const note = unrenderableNote(file);
  if (note !== null) return <p className="px-3 py-4 text-sm text-text-tertiary">{note}</p>;

  return (
    <div className="otomat-review-diff overflow-hidden" onMouseDownCapture={gutter.press}>
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
                target={target}
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
