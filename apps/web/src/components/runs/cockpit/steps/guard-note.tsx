import { Button } from "@otomat/ui";
import { useRunEventStream } from "@web/api/runs/run-event-stream";
import { StepGuardOverrideForm } from "@web/components/runs/cockpit/steps/guard-override-form";
import { stepGuardReading } from "@web/lib/run/step-guard";
import { useState } from "react";

export interface StepGuardNoteProps {
  runId: string;
  stepRunId: string;
  stepName: string;
  /** Only a step the scheduler is actually holding may be released by hand. */
  held: boolean;
}

export function StepGuardNote({ runId, stepRunId, stepName, held }: StepGuardNoteProps) {
  const { events } = useRunEventStream();
  const [overriding, setOverriding] = useState(false);
  const reading = stepGuardReading(events, stepRunId);
  if (reading === null) return null;
  const releasable = reading.blocking && held;

  return (
    <div className="mt-1 ml-5.5 flex flex-col items-start gap-1">
      <p className="text-micro text-text-tertiary">{reading.reason}</p>
      {releasable && !overriding ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOverriding(true)}>
          {`Accept ${stepName} anyway`}
        </Button>
      ) : null}
      {releasable && overriding ? (
        <StepGuardOverrideForm
          runId={runId}
          stepRunId={stepRunId}
          stepName={stepName}
          onCancel={() => setOverriding(false)}
        />
      ) : null}
    </div>
  );
}
