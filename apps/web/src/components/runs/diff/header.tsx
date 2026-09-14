import type { ReviewDiffContract } from "@otomat/domain";
import {
  Icon,
  SegmentedControl,
  SegmentedItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type IconName,
} from "@otomat/ui";
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import {
  DIFF_VIEW_MODES,
  type DiffPrefs,
  type DiffViewMode,
} from "@web/components/runs/diff/prefs/prefs";
import { DiffShortcutsPopover } from "@web/components/runs/diff/shortcuts-popover";
import { DiffSummary } from "@web/components/runs/diff/summary";
import { asMember } from "@web/lib/coerce";
import type { ReactNode } from "react";

const DIFF_MODES = [
  { value: "unified", label: "Unified", tooltip: "Unified diff", icon: "rows-3" },
  { value: "split", label: "Split", tooltip: "Split diff", icon: "columns-3" },
] as const satisfies readonly {
  value: DiffViewMode;
  label: string;
  tooltip: string;
  icon: IconName;
}[];

export interface RunDiffHeaderProps {
  diff: ReviewDiffContract | null;
  scopeControl?: ReactNode;
  search?: ReactNode;
  actions: ReactNode;
  prefs: DiffPrefs;
  onPrefsChange: (patch: Partial<DiffPrefs>) => void;
  browsable: boolean;
  reviewedCount: number;
}

export function RunDiffHeader({
  diff,
  scopeControl,
  search,
  actions,
  prefs,
  onPrefsChange,
  browsable,
  reviewedCount,
}: RunDiffHeaderProps) {
  const fileCount = diff?.files.length ?? 0;
  const hasFiles = fileCount > 0;
  return (
    <header className="flex min-h-10.5 min-w-0 flex-none flex-wrap items-center gap-1.5 border-b border-border-subtle px-3 py-1.5">
      {scopeControl}
      {prefs.stats && diff !== null ? <DiffSummary diff={diff} /> : null}
      {hasFiles ? (
        <span className="flex-none whitespace-nowrap text-xs text-text-tertiary">
          {reviewedCount}/{fileCount} reviewed
        </span>
      ) : null}
      <span className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
        {hasFiles ? search : null}
        <SegmentedControl
          type="single"
          value={prefs.mode}
          onValueChange={(value) => {
            const mode = asMember(value, DIFF_VIEW_MODES);
            if (mode) onPrefsChange({ mode });
          }}
          aria-label="Diff view mode"
        >
          {DIFF_MODES.map((mode) => (
            <Tooltip key={mode.value}>
              <TooltipTrigger
                delay={300}
                render={
                  <SegmentedItem value={mode.value} aria-label={mode.label} className="px-1.5" />
                }
              >
                <Icon name={mode.icon} aria-hidden />
              </TooltipTrigger>
              <TooltipContent>{mode.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </SegmentedControl>
        <DiffPrefsPopover prefs={prefs} onChange={onPrefsChange} browsable={browsable} />
        {actions}
        {hasFiles ? <DiffShortcutsPopover /> : null}
      </span>
    </header>
  );
}
