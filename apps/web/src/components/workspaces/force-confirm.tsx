import { Checkbox } from "@otomat/ui";
import { plural } from "@web/lib/plural";
import { describeCleanupLoss } from "@web/lib/workspace/cleanup";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useId } from "react";

export interface ForceConfirmProps {
  targets: readonly WorkspaceRow[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ForceConfirm({ targets, checked, onCheckedChange }: ForceConfirmProps) {
  const sentenceId = useId();
  const loss = describeCleanupLoss(targets);
  const worktrees = plural(targets.length, "worktree");
  return (
    <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-bg p-2.5 text-xs text-foreground">
      <Checkbox
        checked={checked}
        aria-labelledby={sentenceId}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <span id={sentenceId}>
        {loss === null
          ? `Delete ${worktrees} git still refuses to remove on its own.`
          : `Discard ${loss} in ${worktrees}. This cannot be undone.`}
      </span>
    </div>
  );
}
