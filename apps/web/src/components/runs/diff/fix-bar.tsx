import { isRunTerminal, type RunState } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { ReviewFixStepDialog } from "@web/components/runs/review/fix-step-dialog";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface DiffFixBarProps {
  runStatus: RunState | undefined;
  selection: ReviewSelection;
}

export function DiffFixBar({ runStatus, selection }: DiffFixBarProps) {
  const count = selection.selectedIds.size;
  const workspaceOpen = runStatus !== undefined && !isRunTerminal(runStatus);
  const hint = workspaceOpen
    ? "A fix step freezes the comments, their pinned hunks and the current diff as its context."
    : "Fix is available while this issue’s workspace is still open.";

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
        <ReviewFixStepDialog selection={selection} disabled={!workspaceOpen || count === 0} />
      </span>
    </footer>
  );
}
