import type { WaitablePlanNode } from "@otomat/domain";
import { Field, FieldLabel, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { AfterStepPicker } from "@web/components/runs/steps/after-step-picker";
import { ParallelShareConfirm } from "@web/components/runs/steps/parallel-share-confirm";
import { scheduledAfter, type StepSchedule } from "@web/lib/run/step-schedule";

export interface StepScheduleFieldProps {
  candidates: readonly WaitablePlanNode[];
  value: StepSchedule;
  onChange: (value: StepSchedule) => void;
}

export function StepScheduleField({ candidates, value, onChange }: StepScheduleFieldProps) {
  return (
    <Field className="flex flex-col gap-2">
      <FieldLabel>Starts</FieldLabel>
      <SegmentedControl
        type="single"
        value={value.mode}
        onValueChange={(mode) => {
          if (mode === "after" || mode === "parallel") onChange({ ...value, mode });
        }}
        aria-label="When the step starts"
      >
        <SegmentedItem value="after">After a step</SegmentedItem>
        <SegmentedItem value="parallel">Run in parallel</SegmentedItem>
      </SegmentedControl>
      {value.mode === "parallel" ? (
        <ParallelShareConfirm
          checked={value.confirmed}
          onCheckedChange={(confirmed) => onChange({ ...value, confirmed })}
        />
      ) : (
        <AfterStepPicker
          candidates={candidates}
          after={scheduledAfter(value, candidates)}
          onChange={(after) => onChange({ ...value, after })}
        />
      )}
    </Field>
  );
}
