import type { RunDiffScope, RunDiffScopeSelector } from "@otomat/domain";
import {
  ConfigMenuChoice,
  ConfigMenuNote,
  ConfigMenuSubmenu,
  DropdownMenuRadioGroup,
} from "@otomat/ui";
import { stepChoiceLabel } from "@web/components/runs/diff/scope/label";
import type { RunDiffStep } from "@web/lib/run/diff-steps";

export interface DiffStepSubmenuProps {
  scope: RunDiffScope;
  steps: readonly RunDiffStep[];
  onSelect: (selector: RunDiffScopeSelector) => void;
}

export function DiffStepSubmenu({ scope, steps, onSelect }: DiffStepSubmenuProps) {
  return (
    <ConfigMenuSubmenu
      label="Step"
      value={scope.kind === "step" ? stepChoiceLabel(scope.step_name, scope.step_number) : "none"}
    >
      {steps.length === 0 ? (
        <ConfigMenuNote>This run has planned no step yet.</ConfigMenuNote>
      ) : null}
      <DropdownMenuRadioGroup
        value={scope.kind === "step" ? scope.step_run_id : ""}
        onValueChange={(next) => onSelect({ kind: "step", step: String(next) })}
      >
        {steps.map((step) => (
          <ConfigMenuChoice
            key={step.id}
            value={step.id}
            label={stepChoiceLabel(step.name, step.number)}
            disabled={!step.reconstructable}
            description={
              step.reconstructable
                ? null
                : "No delta: this step captured no pair of git boundaries."
            }
          />
        ))}
      </DropdownMenuRadioGroup>
    </ConfigMenuSubmenu>
  );
}
