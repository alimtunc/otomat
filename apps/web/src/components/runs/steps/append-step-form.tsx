import type {
  AppendRunStepRequest,
  AppendedRunStepResponse,
  IssueContract,
  IssueWorkspace,
} from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Input, Kbd } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAppendRunStep } from "@web/api/runs/mutations";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { useContextSources } from "@web/components/context/use-context-sources";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { RecoveryLinkField } from "@web/components/runs/steps/recovery-link-field";
import { WorkspaceReuseNote } from "@web/components/runs/steps/workspace-reuse-note";
import { contextRequestFields, EMPTY_CONTEXT_DRAFT } from "@web/lib/context/draft";
import { profileRequestFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { useState } from "react";

export interface AppendStepFormProps {
  /** The issue whose workspace the step joins; it is attached to the step's context. */
  issue: IssueContract;
  workspace: Extract<IssueWorkspace, { state: "open" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onAppended: (response: AppendedRunStepResponse) => void;
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
  const [recovers, setRecovers] = useState(true);
  const launchExecution = useLaunchExecution(execution, "profiles");
  const append = useAppendRunStep(workspace.run_id);
  const recovered = issue.execution.state === "failed" ? issue.execution.failure.step : null;
  const sources = useContextSources({
    draft: context,
    issue,
    agentChoice: launchExecution.selection.agent,
    profiles: launchExecution.agents.profiles,
  });
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => {
      const profile = profileRequestFields(launchExecution.request);
      if (!launchExecution.canLaunch || profile === null) return;
      const request: AppendRunStepRequest = {
        name: value.name.trim(),
        ...contextRequestFields(context),
        ...profile,
        depends_on: [],
      };
      if (recovered !== null && recovers) request.replaces = recovered.id;
      append.mutate(request, {
        onSuccess: (response) => {
          form.reset();
          setContext(EMPTY_CONTEXT_DRAFT);
          onAppended(response);
        },
      });
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
        {recovered === null ? null : (
          <RecoveryLinkField step={recovered} checked={recovers} onCheckedChange={setRecovers} />
        )}
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
          scope="profiles"
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
                Add follow-up step
                <Kbd tone="on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
