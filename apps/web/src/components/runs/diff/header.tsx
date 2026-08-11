import type { ReviewState, RunDiffContract } from "@otomat/domain";
import { Kbd, ReviewStatusChip } from "@otomat/ui";
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { DiffSummary } from "@web/components/runs/diff/summary";

const ACTIVE_PATH_CLASS = "min-w-0 truncate font-mono text-xs text-text-secondary";

export interface RunDiffHeaderProps {
  diff: RunDiffContract;
  reviewStatus: ReviewState | null;
  prefs: DiffPrefs;
  onPrefsChange: (patch: Partial<DiffPrefs>) => void;
  browsable: boolean;
  reviewedCount: number;
  activePath: string | null;
}

export function RunDiffHeader({
  diff,
  reviewStatus,
  prefs,
  onPrefsChange,
  browsable,
  reviewedCount,
  activePath,
}: RunDiffHeaderProps) {
  return (
    <header className="flex h-10.5 flex-none items-center gap-2.5 border-b border-border-subtle px-4.5">
      {reviewStatus ? <ReviewStatusChip status={reviewStatus} /> : null}
      {diff.files.length > 0 ? (
        <span className="text-xs text-text-tertiary">
          {reviewedCount}/{diff.files.length} reviewed
        </span>
      ) : null}
      {activePath === null ? null : (
        <span className={ACTIVE_PATH_CLASS} title={activePath}>
          {activePath}
        </span>
      )}
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
        <DiffPrefsPopover prefs={prefs} onChange={onPrefsChange} browsable={browsable} />
        {prefs.stats ? <DiffSummary diff={diff} /> : null}
      </span>
    </header>
  );
}
