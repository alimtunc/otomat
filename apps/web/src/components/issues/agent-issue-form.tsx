import type { ContextReference, RunContract } from "@otomat/domain";
import { AutoTextarea, DialogBody } from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { useDraftPresence } from "@web/components/issues/use-draft-presence";
import { launchBaseFields } from "@web/components/runs/launch/base-request";
import { LaunchComposer } from "@web/components/runs/launch/launch-composer";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { contextRequestFields } from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasText } from "@web/lib/form";
import { useState } from "react";

const COMPOSER_LABEL = "Ad-hoc run";
const LAUNCH_ACTION = "Create & launch";

function unavailableReason(
  pending: boolean,
  hasPrompt: boolean,
  canLaunch: boolean,
): string | null {
  if (pending) return "creating the issue and launching the run";
  if (!hasPrompt) return "write a prompt first";
  if (!canLaunch) return "choose an available agent and model";
  return null;
}

export interface AgentIssueFormProps {
  target: ReadyLaunchTarget;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
  onDraftChange: (hasDraft: boolean) => void;
}

export function AgentIssueForm({
  target,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
  onDraftChange,
}: AgentIssueFormProps) {
  const [references, setReferences] = useState<readonly ContextReference[]>([]);
  const { launch, isPending } = useLaunchRun();
  const launchExecution = useLaunchExecution(execution);

  const form = useForm({
    defaultValues: { prompt: "" },
    onSubmit: async ({ value }) => {
      const run = await launch({
        prompt: value.prompt.trim(),
        project_id: target.repository.project_id,
        ...launchBaseFields(target),
        ...contextRequestFields({ references, note: "" }),
        ...launchExecution.request,
      });
      if (!run) return;
      form.reset();
      setReferences([]);
      onLaunched(run);
    },
  });
  const hasPrompt = useStore(form.store, (state) => hasText(state.values.prompt));

  useDraftPresence(hasPrompt || references.length > 0, onDraftChange);

  return (
    <>
      <DialogBody className="min-h-0 flex-1 overflow-y-auto">
        <LaunchComposer
          issue={null}
          target={target}
          references={references}
          onReferencesChange={setReferences}
          execution={launchExecution}
          onExecutionChange={onExecutionChange}
          label={COMPOSER_LABEL}
          action={LAUNCH_ACTION}
          unavailableReason={unavailableReason(isPending, hasPrompt, launchExecution.canLaunch)}
          pending={isPending}
          onSubmit={() => void form.handleSubmit()}
        >
          <form.Field name="prompt">
            {(field) => (
              <AutoTextarea
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder='Tell the agent what to do, e.g. "implement nested CSV quoting in the parser and open a PR"'
                aria-label="Issue prompt"
              />
            )}
          </form.Field>
        </LaunchComposer>
      </DialogBody>
      <IssueFormFooter onCancel={onCancel} />
    </>
  );
}
