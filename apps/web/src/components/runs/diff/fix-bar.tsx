import type { RunState } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface DiffFixBarProps {
  runStatus: RunState | undefined;
  selection: ReviewSelection;
}

export function DiffFixBar({ runStatus, selection }: DiffFixBarProps) {
  const count = selection.selectedIds.size;
  const fixable = runStatus === "review_ready" && count > 0 && !selection.isFixPending;
  const hint =
    runStatus === "review_ready"
      ? "A follow-up run gets {comment, original hunk, current file}."
      : "Fix is available once the run is review-ready.";

  return (
    <footer className="flex h-12 flex-none items-center gap-2.5 border-t border-border-subtle bg-surface-1 px-4.5">
      <span className="text-xs font-medium text-review">
        {count === 1 ? "1 comment selected" : `${count} comments selected`}
      </span>
      <span className="text-xs text-text-tertiary">{hint}</span>
      <span className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={count === 0} onClick={selection.clear}>
          Clear
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!fixable}
          loading={selection.isFixPending}
          onClick={selection.submitFix}
        >
          <Icon name="wand-2" aria-hidden />
          Fix selected comments
        </Button>
      </span>
    </footer>
  );
}
