import type { StepRunContract } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { StepGuardOverrideForm } from "@web/components/runs/cockpit/steps/guard-override-form";
import { stepGuardReading } from "@web/lib/run/step-guard";
import { useState } from "react";

export function StepGuardNote({ step }: { step: StepRunContract }) {
  const { events } = useRunEventStream();
  const [overriding, setOverriding] = useState(false);
  const reading = stepGuardReading(events, step.id);
  if (reading === null) return null;
  const releasable = reading.blocking && step.status === "awaiting_human";

  return (
    <div className="mt-1 ml-5.5 flex flex-col items-start gap-1">
      <p className="text-micro text-text-tertiary">{reading.reason}</p>
      {releasable && !overriding ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOverriding(true)}>
          {`Accept ${step.name} anyway`}
        </Button>
      ) : null}
      {releasable && overriding ? (
        <StepGuardOverrideForm
          runId={step.run_id}
          stepRunId={step.id}
          stepName={step.name}
          onCancel={() => setOverriding(false)}
        />
      ) : null}
    </div>
  );
}
