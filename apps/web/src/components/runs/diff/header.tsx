import type { ReviewDiffContract } from "@otomat/domain";
import {
  Icon,
  SegmentedControl,
  SegmentedItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@otomat/ui";
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import type { DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { DiffShortcutsPopover } from "@web/components/runs/diff/shortcuts-popover";
import { DiffSummary } from "@web/components/runs/diff/summary";
import type { ReactNode } from "react";

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
            if (value === "unified" || value === "split") onPrefsChange({ mode: value });
          }}
          aria-label="Diff view mode"
        >
          <Tooltip>
            <TooltipTrigger
              delay={300}
              render={<SegmentedItem value="unified" aria-label="Unified" className="px-1.5" />}
            >
              <Icon name="rows-3" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Unified diff</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              delay={300}
              render={<SegmentedItem value="split" aria-label="Split" className="px-1.5" />}
            >
              <Icon name="columns-3" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Split diff</TooltipContent>
          </Tooltip>
        </SegmentedControl>
        <DiffPrefsPopover prefs={prefs} onChange={onPrefsChange} browsable={browsable} />
        {actions}
        {hasFiles ? <DiffShortcutsPopover /> : null}
      </span>
    </header>
  );
}
