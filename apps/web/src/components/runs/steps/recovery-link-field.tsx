import type { IssueExecutionFailure } from "@otomat/domain";
import { Checkbox } from "@otomat/ui";

export interface RecoveryLinkFieldProps {
  step: NonNullable<IssueExecutionFailure["step"]>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function RecoveryLinkField({ step, checked, onCheckedChange }: RecoveryLinkFieldProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-label={`This step recovers ${step.name}`}
        className="mt-0.5"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">
          This step recovers <b className="font-medium text-foreground">{step.name}</b>
        </span>
        <span className="text-xs text-text-tertiary">
          Its failure stays in the history, but stops holding the run in <b>failed</b> once this
          step succeeds.
        </span>
      </span>
    </div>
  );
}
