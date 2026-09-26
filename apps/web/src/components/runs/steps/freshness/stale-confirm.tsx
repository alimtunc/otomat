import { Checkbox } from "@otomat/ui";
import type { FreshnessAcknowledgment } from "@web/lib/run/workspace-freshness";

const ACKNOWLEDGMENTS = {
  stale: {
    label: "Add the step on this outdated workspace anyway",
    sentence:
      "Add the step on this outdated workspace anyway: the agent will not see the remote changes.",
  },
  unchecked: {
    label: "Add the step without checking the remote",
    sentence: "Add the step without checking the remote: the agent may work from an old state.",
  },
} satisfies Record<FreshnessAcknowledgment, { label: string; sentence: string }>;

export interface StaleFreshnessConfirmProps {
  reason: FreshnessAcknowledgment;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function StaleFreshnessConfirm({
  reason,
  checked,
  onCheckedChange,
}: StaleFreshnessConfirmProps) {
  return (
    <span className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-bg p-2.5 text-xs text-foreground">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-label={ACKNOWLEDGMENTS[reason].label}
        className="mt-0.5"
      />
      {ACKNOWLEDGMENTS[reason].sentence}
    </span>
  );
}
