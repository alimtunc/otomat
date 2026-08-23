import type { ReviewState, ReviewDiffContract } from "@otomat/domain";
import { ReviewStatusChip } from "@otomat/ui";
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { DiffShortcutsPopover } from "@web/components/runs/diff/shortcuts-popover";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { ReactNode } from "react";

const ACTIVE_PATH_CLASS = "min-w-0 truncate font-mono text-xs text-text-secondary";

export interface RunDiffHeaderProps {
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
      <span className="ml-auto flex items-center gap-2.5">
        {hasFiles ? search : null}
        {hasFiles ? <DiffShortcutsPopover /> : null}
        <DiffPrefsPopover prefs={prefs} onChange={onPrefsChange} browsable={browsable} />
        {prefs.stats && diff !== null ? <DiffSummary diff={diff} /> : null}
      </span>
    </header>
  );
}
