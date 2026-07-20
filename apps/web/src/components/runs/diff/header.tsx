import type { ReviewState, RunDiffContract } from "@otomat/domain";
import { Icon, Kbd, ReviewStatusChip, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { DiffViewMode } from "@web/components/runs/diff/view-prefs";

export interface RunDiffHeaderProps {
  diff: RunDiffContract;
  reviewStatus: ReviewState | null;
  mode: DiffViewMode;
  onModeChange: (mode: DiffViewMode) => void;
  reviewedCount: number;
}

export function RunDiffHeader({
  diff,
  reviewStatus,
  mode,
  onModeChange,
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
