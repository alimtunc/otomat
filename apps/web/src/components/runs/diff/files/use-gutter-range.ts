import {
  SplitSide,
  type DiffViewWithMultiSelectProps,
  type DiffViewWithMultiSelectRef,
} from "@git-diff-view/react";
import type { DiffSide } from "@otomat/domain";
import { gutterLine } from "@web/components/runs/diff/files/gutter-line";
import type { DiffViewMode } from "@web/components/runs/diff/prefs/prefs";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";

/** @git-diff-view hands its widget store out through this callback and exports no type for it. */
type WidgetStore = Parameters<
  NonNullable<DiffViewWithMultiSelectProps["onCreateUseWidgetHook"]>
>[0];

export interface GutterRange {
  side: DiffSide;
  start: number;
  end: number;
}

export interface GutterRangeSelection {
  attachWidget: (store: WidgetStore) => void;
  /** Anchors the composer on `range`, opening it on the range's last line. */
  select: (range: GutterRange) => void;
  /** Grows or shrinks the open range by one line, leaving the composer on the row it opened on. */
  moveEdge: (edge: "start" | "end", by: 1 | -1) => void;
  /** The anchor a composer on this line carries: the selection when it ends here, else the line alone. */
  rangeAt: (side: DiffSide, line: number) => { start: number; end: number };
  /** The gutter presses @git-diff-view's selection manager must not act on. */
  press: (event: MouseEvent<HTMLElement>) => void;
  close: () => void;
}

/** @git-diff-view spans the whole gutter between the lowest and highest number it is given. */
function markedBounds(shown: GutterRange | null, side: DiffSide): number[] {
  return shown === null || shown.side !== side ? [] : [shown.start, shown.end];
}

/** Sole owner of the reviewer's line range: the gutter marks, the composer and its anchor all read it. */
export function useGutterRange(
  view: RefObject<DiffViewWithMultiSelectRef | null>,
  mode: DiffViewMode,
  wrap: boolean,
): GutterRangeSelection {
  const [range, setRange] = useState<GutterRange | null>(null);
  const widget = useRef<WidgetStore | null>(null);

  /** @git-diff-view goes on painting the selection it last tracked until that one is dropped. */
  const mark = (shown: GutterRange | null): void => {
    view.current?.clearSelection();
    view.current?.setPreselectedLines({
      old: markedBounds(shown, "old"),
      new: markedBounds(shown, "new"),
    });
  };

  const retarget = (next: GutterRange): void => {
    setRange(next);
    mark(next);
  };

  const select = (next: GutterRange): void => {
    retarget(next);
    widget.current?.getReadonlyState().setWidget({
      side: next.side === "old" ? SplitSide.old : SplitSide.new,
      lineNumber: next.end,
    });
  };

  // otomat-allow-effect: a wrap toggle makes @git-diff-view drop its marks; only re-marking restores them.
  useEffect(() => {
    if (range !== null) mark(range);
  }, [wrap]);

  // otomat-allow-effect: a mode switch recreates @git-diff-view's widget store; re-selecting reopens the composer.
  useEffect(() => {
    if (range !== null) select(range);
  }, [mode]);

  return {
    attachWidget: useCallback((store) => {
      widget.current = store;
    }, []),
    select,
    moveEdge: (edge, by) => {
      if (range === null) return;
      const next = { ...range, [edge]: range[edge] + by };
      if (next.start < 1 || next.start > next.end) return;
      retarget(next);
    },
    rangeAt: (side, line) =>
      range !== null && range.side === side && range.end === line
        ? { start: range.start, end: range.end }
        : { start: line, end: line },
    press: (event) => {
      const target = gutterLine(event.target);
      if (target === null) return;
      // Comments render on head lines only (extendDataFor), so the base side offers no anchor.
      if (target.side === "old") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // The manager restarts a one-line selection under a shift+click instead of extending this one.
      if (!event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      const open = range !== null && range.side === target.side ? range : null;
      const anchor = open?.start ?? target.line;
      const next = {
        side: target.side,
        start: Math.min(anchor, target.line),
        end: Math.max(anchor, target.line),
      };
      // Extending re-marks only: the composer keeps its row and the draft it holds.
      if (open === null) select(next);
      else retarget(next);
    },
    close: () => {
      setRange(null);
      mark(null);
    },
  };
}
