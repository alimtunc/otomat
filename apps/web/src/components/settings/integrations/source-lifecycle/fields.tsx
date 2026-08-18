import {
  LIFECYCLE_PHASE_STATE_TYPE,
  LINEAR_LIFECYCLE_PHASES,
  projectLinearLifecycleReadiness,
  type IssueSourceContract,
  type LinearLifecyclePhase,
  type LinearWorkflowState,
} from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useReconcileIssueSource, useUpdateIssueSource } from "@web/api/linear/mutations";
import { LIFECYCLE_PHASE_LABEL } from "@web/lib/linear-lifecycle";

import { LifecyclePhaseSelect } from "./phase-select";
import { LifecycleReadiness } from "./readiness";

export interface SourceLifecycleFieldsProps {
  source: IssueSourceContract;
  states: readonly LinearWorkflowState[];
}

export function SourceLifecycleFields({ source, states }: SourceLifecycleFieldsProps) {
  const update = useUpdateIssueSource();
  const reconcile = useReconcileIssueSource();
  const readiness = projectLinearLifecycleReadiness({
    lifecycle: source.lifecycle,
    error: source.lifecycle_error,
    available: states.length > 0,
  });

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

  if (readiness.status === "unavailable") return <LifecycleReadiness readiness={readiness} />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        {LINEAR_LIFECYCLE_PHASES.map((phase) => (
          <LifecyclePhaseSelect
            key={phase}
            label={LIFECYCLE_PHASE_LABEL[phase]}
            mapped={source.lifecycle[phase]}
            candidates={states.filter((state) => state.type === LIFECYCLE_PHASE_STATE_TYPE[phase])}
            disabled={update.isPending}
            onValueChange={(stateId) => save(phase, stateId)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <LifecycleReadiness readiness={readiness} />
        {source.lifecycle.in_progress === null ? null : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="flex-none"
            loading={reconcile.isPending}
            onClick={() => reconcile.mutate(source.id)}
          >
            Apply to open issues
          </Button>
        )}
      </div>
    </div>
  );
}
