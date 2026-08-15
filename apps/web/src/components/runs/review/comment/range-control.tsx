import type { DiffSide } from "@otomat/domain";
import { Icon, IconButton } from "@otomat/ui";
import { sideLabel } from "@web/components/runs/review/comment/anchor";

const EDGES = [
  { edge: "start", label: "range start" },
  { edge: "end", label: "range end" },
] as const;

export interface CommentRangeControlProps {
  filePath: string;
  side: DiffSide;
  range: { start: number; end: number } | null;
  /** Keyboard-reachable equivalent of dragging the gutter; absent for a whole-file anchor. */
  onMoveEdge?: (edge: "start" | "end", by: 1 | -1) => void;
}

function describeRange(range: CommentRangeControlProps["range"]): string {
  if (range === null) return "the whole file";
  if (range.start === range.end) return `line ${range.start}`;
  return `lines ${range.start}–${range.end}`;
}

export function CommentRangeControl({
  filePath,
  side,
  range,
  onMoveEdge,
}: CommentRangeControlProps) {
  const anchor = describeRange(range);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-text-tertiary">
      <span>
        {filePath} · {anchor} · {sideLabel(side)} side
      </span>
      {range === null || onMoveEdge === undefined
        ? null
        : EDGES.map(({ edge, label }) => (
            <span key={edge} className="flex items-center">
              <IconButton
                size="sm"
                label={`Move the ${label} up one line`}
                icon={<Icon name="arrow-up" />}
                onClick={() => onMoveEdge(edge, -1)}
              />
              <IconButton
                size="sm"
                label={`Move the ${label} down one line`}
                icon={<Icon name="arrow-down" />}
                onClick={() => onMoveEdge(edge, 1)}
              />
            </span>
          ))}
    </div>
  );
}
