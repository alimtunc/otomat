import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { WorkflowCompeteCard } from "@web/components/workflow/compete-card";
import type { WorkflowPlanExecution } from "@web/components/workflow/plan-execution";
import { WorkflowStepCard } from "@web/components/workflow/step-card";
import type { PlanDraft } from "@web/components/workflow/use-plan-draft";
import { workflowExecutableCount } from "@web/lib/workflow-draft";

export interface WorkflowPlanEditorProps {
  plan: PlanDraft;
  execution: WorkflowPlanExecution;
  projectId: string | null;
  error: string | null;
}

/** Composes the node graph itself; whatever level sits above it owns its own execution picker. */
export function WorkflowPlanEditor({ plan, execution, projectId, error }: WorkflowPlanEditorProps) {
  const executables = workflowExecutableCount(plan.steps);

  return (
    <div className="flex flex-col gap-2">
      {plan.steps.map((step, index) =>
        step.kind === "compete" ? (
          <WorkflowCompeteCard
            key={step.key}
            plan={plan}
            index={index}
            execution={execution}
            projectId={projectId}
          />
        ) : (
          <WorkflowStepCard
            key={step.key}
            plan={plan}
            index={index}
            execution={execution}
            projectId={projectId}
          />
        ),
      )}
      <div className="flex items-center gap-2 self-start">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={executables >= RUN_PLAN_MAX_STEPS}
          onClick={plan.addStep}
        >
          <Icon name="plus" aria-hidden />
          Add step
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={executables > RUN_PLAN_MAX_STEPS - 2}
          onClick={plan.addCompeteGroup}
        >
          <Icon name="workflow" aria-hidden />
          Add compete group
        </Button>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
