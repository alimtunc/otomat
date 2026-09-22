import { Checkbox } from "@otomat/ui";

export interface ParallelShareConfirmProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ParallelShareConfirm({ checked, onCheckedChange }: ParallelShareConfirmProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-bg p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-label="I understand two agents may edit this workspace at the same time"
        className="mt-0.5"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm text-foreground">
          Two agents may edit the same workspace at the same time.
        </span>
        <span className="text-xs text-text-secondary">
          The step starts now, on the same branch and worktree as any running session, and nothing
          keeps their changes apart. Confirm to add it.
        </span>
      </span>
    </div>
  );
}
