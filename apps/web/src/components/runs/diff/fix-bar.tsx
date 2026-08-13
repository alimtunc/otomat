import type { ReviewFixAuthority } from "@otomat/domain";
import { Button, Chip } from "@otomat/ui";
import { ReviewFixStepDialog } from "@web/components/runs/review/fix-step-dialog";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";

export interface DiffFixBarProps {
  /** Whether this run still owns its issue's workspace; a fix is one more step in that same cycle. */
  workspaceOpen: boolean;
  issueId: string | null;
  authority: ReviewFixAuthority;
  selection: ReviewSelection;
}

export function DiffFixBar({ workspaceOpen, issueId, authority, selection }: DiffFixBarProps) {
  const count = selection.selectedIds.size;
  const owned = authority.kind === "otomat";
  const ownedHint = workspaceOpen
    ? "A fix step freezes the comments, their pinned hunks and the current diff as its context."
    : "Fix is available while this issue’s workspace is still open.";
  const hint = owned ? ownedHint : authority.reason;

  return (
    <footer className="flex h-12 flex-none items-center gap-2.5 border-t border-border-subtle bg-surface-1 px-4.5">
      <span className="text-xs font-medium text-review">
        {count === 1 ? "1 comment selected" : `${count} comments selected`}
      </span>
      {owned ? null : <Chip tone="neutral">Review only</Chip>}
      <span className="min-w-0 truncate text-xs text-text-tertiary" title={hint}>
        {hint}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={count === 0} onClick={selection.clear}>
          Clear
        </Button>
        {owned ? (
          <ReviewFixStepDialog
            selection={selection}
            issueId={issueId}
            disabled={!workspaceOpen || count === 0}
          />
        ) : null}
      </span>
    </footer>
  );
}
