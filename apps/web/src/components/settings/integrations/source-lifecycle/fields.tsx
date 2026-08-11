import {
  LINEAR_LIFECYCLE_PHASES,
  type IssueSourceContract,
  type LinearLifecyclePhase,
  type LinearWorkflowState,
} from "@otomat/domain";
import { useUpdateIssueSource } from "@web/api/linear/mutations";
import { LIFECYCLE_PHASE_LABEL } from "@web/lib/linear-lifecycle";

import { LifecyclePhaseSelect } from "./phase-select";

export interface SourceLifecycleFieldsProps {
  source: IssueSourceContract;
  states: readonly LinearWorkflowState[];
}

export function SourceLifecycleFields({ source, states }: SourceLifecycleFieldsProps) {
  const update = useUpdateIssueSource();

  const save = (phase: LinearLifecyclePhase, stateId: string | null): void => {
    update.mutate({
      sourceId: source.id,
      request: {
        in_progress_state_id:
          phase === "in_progress" ? stateId : (source.lifecycle.in_progress?.id ?? null),
        done_state_id: phase === "done" ? stateId : (source.lifecycle.done?.id ?? null),
      },
    });
  };

  if (states.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        Linear statuses are unavailable, so this source's run mapping cannot be changed right now.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-2">
      {LINEAR_LIFECYCLE_PHASES.map((phase) => (
        <LifecyclePhaseSelect
          key={phase}
          label={LIFECYCLE_PHASE_LABEL[phase]}
          value={source.lifecycle[phase]?.id ?? null}
          states={states}
          disabled={update.isPending}
          onValueChange={(stateId) => save(phase, stateId)}
        />
      ))}
    </div>
  );
}
