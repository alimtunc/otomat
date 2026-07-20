import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import {
  Button,
  DialogBody,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Kbd,
  Textarea,
} from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { IssueFormFooter } from "@web/components/issues/issue-form-footer";
import { RuntimePicker } from "@web/components/runs/launch/runtime-picker";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { resolveRuntimeChoice } from "@web/lib/runtimes";
import { isWorkflowNodeComplete, workflowExecutableCount } from "@web/lib/workflow-plan";

import { useWorkflowForm } from "./use-workflow-form";
import { WorkflowCompeteCard } from "./workflow-compete-card";
import { WorkflowStepCard } from "./workflow-step-card";

export interface WorkflowIssueFormProps {
  projectId: string | undefined;
  runtimeChoice: string | null;
  onRuntimeChoice: (runtime: string) => void;
  onLaunched: () => void;
  onCancel: () => void;
}

export function WorkflowIssueForm({
  projectId,
  runtimeChoice,
  onRuntimeChoice,
  onLaunched,
  onCancel,
}: WorkflowIssueFormProps) {
  const runtimes = useRuntimes();
  const descriptors = runtimes.data ?? [];
  const runtime = resolveRuntimeChoice(descriptors, runtimeChoice);
  const { form, planError, isPending, updateSteps, addStep, addCompeteGroup } = useWorkflowForm({
    projectId,
    runtime,
    onLaunched,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
        <form.Field
          name="goal"
          validators={{ onChange: requiredTrimmed("Describe the overall goal.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Goal</FieldLabel>
              <FieldControl>
                <Textarea
                  autoFocus
                  rows={2}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="What should this workflow achieve? Becomes the issue."
                  aria-label="Workflow goal"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <RuntimePicker
          descriptors={descriptors}
          value={runtime}
          onValueChange={onRuntimeChoice}
          isPending={runtimes.isPending}
          isError={runtimes.isError}
          isSuccess={runtimes.isSuccess}
          onRetry={() => void runtimes.refetch()}
        />
        <form.Field name="steps">
          {(stepsField) => (
            <div className="flex flex-col gap-2">
              {stepsField.state.value.map((step, index) =>
                step.kind === "compete" ? (
                  <WorkflowCompeteCard
                    key={step.key}
                    form={form}
                    steps={stepsField.state.value}
                    index={index}
                    descriptors={descriptors}
                    onUpdateSteps={updateSteps}
                  />
                ) : (
                  <WorkflowStepCard
                    key={step.key}
                    form={form}
                    steps={stepsField.state.value}
                    index={index}
                    descriptors={descriptors}
                    onUpdateSteps={updateSteps}
                  />
                ),
              )}
              <div className="flex items-center gap-2 self-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={workflowExecutableCount(stepsField.state.value) >= RUN_PLAN_MAX_STEPS}
                  onClick={addStep}
                >
                  <Icon name="plus" aria-hidden />
                  Add step
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    workflowExecutableCount(stepsField.state.value) > RUN_PLAN_MAX_STEPS - 2
                  }
                  onClick={addCompeteGroup}
                >
                  <Icon name="git-compare" aria-hidden />
                  Add compete group
                </Button>
              </div>
            </div>
          )}
        </form.Field>
        {planError === null ? null : (
          <p role="alert" className="text-xs text-danger">
            {planError}
          </p>
        )}
        {projectId === undefined ? (
          <p className="text-xs text-danger">Select a project before launching a workflow.</p>
        ) : null}
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              hasText(state.values.goal) &&
              state.values.steps.length > 0 &&
              state.values.steps.every(isWorkflowNodeComplete)
            }
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!(filled && runtime !== null && projectId !== undefined && !isPending)}
              >
                Launch workflow
                <Kbd className="border-[rgba(255,255,255,.4)] text-on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
