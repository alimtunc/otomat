import type { RunDetail } from "@otomat/domain";
import { RunStatusChip, SessionStatusChip, StepStatusChip } from "@otomat/ui";

export function RunStatusBar({ detail }: { detail: RunDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-6 py-3">
      <RunStatusChip status={detail.run.status} />
      {detail.steps.map((step) => (
        <StepStatusChip key={step.id} status={step.status} />
      ))}
      {detail.sessions.map((session) => (
        <SessionStatusChip key={session.id} status={session.status} />
      ))}
    </div>
  );
}
