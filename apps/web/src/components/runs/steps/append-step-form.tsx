import type {
  AppendRunStepRequest,
  AppendedRunStepResponse,
  IssueContract,
  IssueWorkspace,
} from "@otomat/domain";
import {
  Button,
  DialogBody,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  Input,
  Kbd,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useAppendRunStep, useUpdateWorkspace } from "@web/api/runs/mutations";
import { useRunDetail, useWorkspaceFreshness } from "@web/api/runs/queries";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { useContextSources } from "@web/components/context/use-context-sources";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { WorkspaceFreshnessNotice } from "@web/components/runs/steps/freshness/notice";
import { StaleFreshnessConfirm } from "@web/components/runs/steps/freshness/stale-confirm";
import { RecoveryLinkField } from "@web/components/runs/steps/recovery-link-field";
import { StepScheduleField } from "@web/components/runs/steps/step-schedule-field";
import { WorkspaceReuseNote } from "@web/components/runs/steps/workspace-reuse-note";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { contextRequestFields, EMPTY_CONTEXT_DRAFT } from "@web/lib/context/draft";
import { agentSelectionFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import {
  DEFAULT_STEP_SCHEDULE,
  scheduleCandidates,
  scheduleReady,
  scheduleRequestFields,
} from "@web/lib/run/step-schedule";
import { freshnessCleared, freshnessGate } from "@web/lib/run/workspace-freshness";
import { useState } from "react";

export interface AppendStepFormProps {
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
  const launchExecution = useLaunchExecution(execution);
  const append = useAppendRunStep(workspace.run_id);
  const detail = useRunDetail(workspace.run_id);
  const freshness = useWorkspaceFreshness(workspace.run_id);
  const update = useUpdateWorkspace(workspace.run_id);
  const gate = freshnessGate(freshness);
  const recovered = issue.execution.state === "failed" ? issue.execution.failure.step : null;
  const sources = useContextSources({
    draft: context,
    issue,
    agentChoice: launchExecution.selection.agent,
    profiles: launchExecution.agents.profiles,
  });
  const form = useForm({
    defaultValues: { name: "", schedule: DEFAULT_STEP_SCHEDULE, staleAcknowledged: "" },
    onSubmit: ({ value }) => {
      const agent = agentSelectionFields(launchExecution.request);
      if (!launchExecution.canLaunch || agent === null || detail.data === undefined) return;
      if (update.isPending || !freshnessCleared(gate, value.staleAcknowledged)) return;
      const request: AppendRunStepRequest = {
        name: value.name.trim(),
        ...contextRequestFields(context),
        ...agent,
        ...scheduleRequestFields(value.schedule, scheduleCandidates(detail.data)),
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
        <WorkspaceFreshnessNotice freshness={freshness} update={update} busy={workspace.busy} />
        {gate.kind === "acknowledge" ? (
          <form.Field name="staleAcknowledged">
            {(field) => (
              <StaleFreshnessConfirm
                reason={gate.reason}
                checked={field.state.value === gate.key}
                onCheckedChange={(checked) => field.handleChange(checked ? gate.key : "")}
              />
            )}
          </form.Field>
        ) : null}
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
        <form.Field name="schedule">
          {(field) => (
            <QueryBoundary
              query={detail}
              pending={<p className="text-xs text-text-tertiary">Loading the plan…</p>}
              error={
                <EmptyState
                  variant="compact"
                  tone="error"
                  icon="alert-triangle"
                  title="Couldn’t load the plan"
                  description="The step can’t be scheduled until the daemon answers."
                  action={
                    <Button variant="outline" size="xs" onClick={() => void detail.refetch()}>
                      Retry
                    </Button>
                  }
                />
              }
            >
              {(data) => (
                <StepScheduleField
                  candidates={scheduleCandidates(data)}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              )}
            </QueryBoundary>
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
          <form.Subscribe
            selector={(state) =>
              hasText(state.values.name) &&
              detail.data !== undefined &&
              scheduleReady(state.values.schedule) &&
              freshnessCleared(gate, state.values.staleAcknowledged)
            }
          >
            {(ready) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={append.isPending}
                disabled={
                  !(ready && launchExecution.canLaunch && !append.isPending && !update.isPending)
                }
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
