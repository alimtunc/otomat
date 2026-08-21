import type { ReviewState, ReviewDiffContract } from "@otomat/domain";
import { Kbd, ReviewStatusChip } from "@otomat/ui";
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { ReactNode } from "react";

const ACTIVE_PATH_CLASS = "min-w-0 truncate font-mono text-xs text-text-secondary";

export interface RunDiffHeaderProps {
  /** Null when the chosen scope has no diff; the header still states which scope that was. */
  diff: ReviewDiffContract | null;
  scopeControl?: ReactNode;
  search?: ReactNode;
  reviewStatus: ReviewState | null;
  prefs: DiffPrefs;
  onPrefsChange: (patch: Partial<DiffPrefs>) => void;
  browsable: boolean;
  reviewedCount: number;
  activePath: string | null;
}

export function RunDiffHeader({
  diff,
  scopeControl,
  search,
  reviewStatus,
  prefs,
  onPrefsChange,
  browsable,
  reviewedCount,
  activePath,
}: RunDiffHeaderProps) {
  const fileCount = diff?.files.length ?? 0;
  const hasFiles = fileCount > 0;
  return (
    <header className="flex h-10.5 flex-none items-center gap-2.5 border-b border-border-subtle px-4.5">
      {scopeControl}
      {reviewStatus ? <ReviewStatusChip status={reviewStatus} /> : null}
      {hasFiles ? (
        <span className="text-xs text-text-tertiary">
          {reviewedCount}/{fileCount} reviewed
        </span>
      ) : null}
      {activePath === null ? null : (
        <span className={ACTIVE_PATH_CLASS} title={activePath}>
          {activePath}
        </span>
      )}
      {hasFiles ? (
        <span className="hidden items-center gap-1.5 text-[10px] text-text-tertiary xl:flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd> files
          <Kbd>n</Kbd>
          <Kbd>p</Kbd> changes
          <Kbd>v</Kbd> reviewed
          <Kbd>⌘F</Kbd> find
          <Kbd>esc</Kbd> back
        </span>
      ) : null}
      <span className="ml-auto flex items-center gap-2.5">
        {hasFiles ? search : null}
        <DiffPrefsPopover prefs={prefs} onChange={onPrefsChange} browsable={browsable} />
        {prefs.stats && diff !== null ? <DiffSummary diff={diff} /> : null}
      </span>
    </header>
  );
}
