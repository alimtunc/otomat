import { Button, Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useOverrideStepDelivery } from "@web/api/runs/step-mutations";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";

export interface StepGuardOverrideFormProps {
  runId: string;
  stepRunId: string;
  stepName: string;
  onCancel: () => void;
}

export function StepGuardOverrideForm({
  runId,
  stepRunId,
  stepName,
  onCancel,
}: StepGuardOverrideFormProps) {
  const override = useOverrideStepDelivery(runId);
  const form = useForm({
    defaultValues: { note: "" },
    onSubmit: ({ value }) => override.mutate({ stepId: stepRunId, note: value.note }),
  });

  return (
    <form
      className="flex flex-col gap-1.5 rounded-md bg-danger-bg p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p role="alert" className="text-xs text-danger">
        {`Accepting ${stepName} starts the steps that wait on it without the evidence the guard asked for. The run history records that you did.`}
      </p>
      <form.Field
        name="note"
        validators={{ onChange: requiredTrimmed("Say why you are accepting it anyway.") }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldLabel>Reason</FieldLabel>
            <FieldControl>
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="audited by hand"
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex gap-1.5">
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type="submit"
              variant="ghost"
              size="xs"
              disabled={!canSubmit}
              loading={override.isPending}
            >
              Accept it anyway
            </Button>
          )}
        </form.Subscribe>
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          Keep it held
        </Button>
      </div>
    </form>
  );
}
