import { Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { WorkflowForm } from "@web/components/issues/workflow/use-form";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps } from "@web/lib/form";
import {
  supervisionBudgetError,
  supervisionRoundsError,
} from "@web/lib/workflow/supervision-request";

export interface SupervisionControlProps {
  form: WorkflowForm;
  agents: LaunchAgentChoice;
  value: ExecutionSelection;
  onChange: (value: ExecutionSelection) => void;
  disabled: boolean;
}

export function SupervisionControl({
  form,
  agents,
  value,
  onChange,
  disabled,
}: SupervisionControlProps) {
  const supervised = value.agent !== null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ExecutionConfigPicker
        compact
        level="launch"
        value={value}
        onChange={onChange}
        profiles={agents.profiles}
        descriptors={agents.descriptors}
        skills={agents.skills}
        label="Supervisor"
        disabled={disabled}
      />
      {supervised ? (
        <>
          <form.Field name="supervisionMaxLoops" validators={{ onChange: supervisionRoundsError }}>
            {(field) => (
              <Field {...fieldErrorProps(field.state.meta)}>
                <FieldLabel>Rounds</FieldLabel>
                <FieldControl>
                  <Input
                    className="w-20"
                    inputMode="numeric"
                    disabled={disabled}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-label="Supervision rounds per step"
                  />
                </FieldControl>
              </Field>
            )}
          </form.Field>
          <form.Field name="supervisionBudget" validators={{ onChange: supervisionBudgetError }}>
            {(field) => (
              <Field {...fieldErrorProps(field.state.meta)}>
                <FieldLabel>Budget (USD)</FieldLabel>
                <FieldControl>
                  <Input
                    className="w-24"
                    inputMode="decimal"
                    placeholder="uncapped"
                    disabled={disabled}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-label="Supervision budget in USD"
                  />
                </FieldControl>
              </Field>
            )}
          </form.Field>
        </>
      ) : null}
    </div>
  );
}
