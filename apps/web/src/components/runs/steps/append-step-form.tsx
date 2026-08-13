import type { IssueContract, IssueWorkspace, RunContract } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Input, Kbd } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAppendRunStep } from "@web/api/runs/mutations";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { useContextSources } from "@web/components/context/use-context-sources";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { WorkspaceReuseNote } from "@web/components/runs/steps/workspace-reuse-note";
import { contextRequestFields, EMPTY_CONTEXT_DRAFT } from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { useState } from "react";

export interface AppendStepFormProps {
  /** The issue whose workspace the step joins; it is attached to the step's context. */
  issue: IssueContract;
  workspace: Extract<IssueWorkspace, { state: "open" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onAppended: (run: RunContract) => void;
  onCancel: () => void;
}

export function AppendStepForm({
  issue,
  workspace,
  execution,
  onExecutionChange,
  onAppended,
  onCancel,
}: AppendStepFormProps) {
  const [context, setContext] = useState(EMPTY_CONTEXT_DRAFT);
  const launchExecution = useLaunchExecution(execution);
  const append = useAppendRunStep(workspace.run_id);
  const sources = useContextSources({
    draft: context,
    issue,
    agentChoice: launchExecution.selection.agent,
    profiles: launchExecution.agents.profiles,
  });
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => {
      if (!launchExecution.canLaunch) return;
      append.mutate(
        {
          name: value.name.trim(),
          ...contextRequestFields(context),
          ...launchExecution.request,
          depends_on: [],
        },
        {
          onSuccess: (run) => {
            form.reset();
            setContext(EMPTY_CONTEXT_DRAFT);
            onAppended(run);
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex flex-col gap-3">
        <WorkspaceReuseNote workspace={workspace} />
        <form.Field name="name" validators={{ onChange: requiredTrimmed("Name the step.") }}>
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Step name</FieldLabel>
              <FieldControl>
                <Input
                  autoFocus
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Address the failing test"
                  aria-label="Step name"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <ContextComposer
          issue={issue}
          projectId={issue.project_id}
          value={context}
          onChange={setContext}
          label="Appended step"
          noteRows={4}
        />
        <ContextSourcesPanel sources={sources} />
        <LaunchExecutionPicker
          execution={launchExecution}
          onChange={onExecutionChange}
          label="Appended step"
        />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe selector={(state) => hasText(state.values.name)}>
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={append.isPending}
                disabled={!(filled && launchExecution.canLaunch && !append.isPending)}
              >
                Add step
                <Kbd tone="on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
