import type { ReviewState, RunDiffContract } from "@otomat/domain";
import { Icon, Kbd, ReviewStatusChip, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { DiffBrowserMode, DiffViewMode } from "@web/components/runs/diff/view-prefs";

export interface RunDiffHeaderProps {
  diff: RunDiffContract;
  reviewStatus: ReviewState | null;
  mode: DiffViewMode;
  onModeChange: (mode: DiffViewMode) => void;
  /** null when the layout has no file sidebar to switch, so no control is offered. */
  browserMode: DiffBrowserMode | null;
  onBrowserModeChange: (mode: DiffBrowserMode) => void;
  reviewedCount: number;
}

export function RunDiffHeader({
  diff,
  reviewStatus,
  mode,
  onModeChange,
  browserMode,
  onBrowserModeChange,
  reviewedCount,
}: RunDiffHeaderProps) {
  return (
    <header className="flex h-10.5 flex-none items-center gap-2.5 border-b border-border-subtle px-4.5">
      {reviewStatus ? <ReviewStatusChip status={reviewStatus} /> : null}
      {diff.files.length > 0 ? (
        <span className="text-xs text-text-tertiary">
          {reviewedCount}/{diff.files.length} reviewed
        </span>
      ) : null}
      {diff.files.length > 0 ? (
        <span className="hidden items-center gap-1.5 text-[10px] text-text-tertiary xl:flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd> files
          <Kbd>n</Kbd>
          <Kbd>p</Kbd> changes
          <Kbd>v</Kbd> reviewed
          <Kbd>esc</Kbd> back
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2.5">
        {browserMode === null ? null : (
          <SegmentedControl
            type="single"
            value={browserMode}
            onValueChange={(value) => {
              if (value === "files" || value === "tree") onBrowserModeChange(value);
            }}
            aria-label="File browser mode"
          >
            <SegmentedItem value="files" icon={<Icon name="list" />}>
              Files
            </SegmentedItem>
            <SegmentedItem value="tree" icon={<Icon name="list-tree" />}>
              Tree
            </SegmentedItem>
          </SegmentedControl>
        )}
        <SegmentedControl
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === "unified" || value === "split") onModeChange(value);
          }}
          aria-label="Diff view mode"
        >
          <SegmentedItem value="unified" icon={<Icon name="rows-3" />}>
            Unified
          </SegmentedItem>
          <SegmentedItem value="split" icon={<Icon name="columns-3" />}>
            Split
          </SegmentedItem>
        </SegmentedControl>
        <DiffSummary diff={diff} />
      </span>
    </header>
  );
}
