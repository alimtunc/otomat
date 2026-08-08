import type { IssueWorkspace } from "@otomat/domain";
import { Chip, Icon } from "@otomat/ui";

export interface WorkspaceReuseNoteProps {
  workspace: Extract<IssueWorkspace, { state: "open" }>;
}

/** Says plainly which branch the new work lands on, and that a live turn is not raced. */
export function WorkspaceReuseNote({ workspace }: WorkspaceReuseNoteProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Icon name="git-compare" aria-hidden className="h-3.5 w-3.5 text-text-tertiary" />
        <span>This issue already works in</span>
        <Chip tone="ghost">{workspace.branch}</Chip>
      </p>
      <p className="text-xs text-text-tertiary">
        {workspace.busy
          ? "A turn is running there right now — this step is queued behind it and starts when the workspace is free."
          : "The step runs in that same worktree, on the same history. No second worktree is created."}
      </p>
    </div>
  );
}
