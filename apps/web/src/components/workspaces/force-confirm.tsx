import { Checkbox } from "@otomat/ui";
import { describeCleanupLoss } from "@web/lib/workspace/cleanup";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { useId } from "react";

export interface ForceConfirmProps {
  target: WorkspaceRow;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ForceConfirm({
  target,
  checked,
  disabled = false,
  onCheckedChange,
}: ForceConfirmProps) {
  const sentenceId = useId();
  const loss = describeCleanupLoss([target]);
  return (
    <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-bg p-2.5 text-xs text-foreground">
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={`Force delete ${target.branch ?? target.path}`}
        aria-describedby={sentenceId}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <span id={sentenceId}>
        {loss === null
          ? `Delete this worktree git still refuses to remove on its own.`
          : `Discard ${loss} in this worktree. This cannot be undone.`}
      </span>
    </div>
  );
}
