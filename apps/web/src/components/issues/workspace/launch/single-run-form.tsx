import type { ContextReference, IssueContract, RunContract } from "@otomat/domain";
import { AutoTextarea, DialogBody } from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { useContextSources } from "@web/components/context/use-context-sources";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchComposer } from "@web/components/runs/launch/launch-composer";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { contextRequestFields } from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { useState } from "react";

const COMPOSER_LABEL = "Single run";
const LAUNCH_ACTION = "Launch run";

export interface SingleRunLaunchFormProps {
  issue: IssueContract;
  target: ReadyLaunchTarget;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

function unavailableReason(pending: boolean, canLaunch: boolean): string | null {
  if (pending) return "launching the run";
  if (!canLaunch) return "choose an available agent and model";
  return null;
}

export function SingleRunLaunchForm({
  issue,
  target,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
}: SingleRunLaunchFormProps) {
  const [references, setReferences] = useState<readonly ContextReference[]>([]);
  const launchExecution = useLaunchExecution(execution);
  const { launch, isPending } = useLaunchRun();

  const form = useForm({
    defaultValues: { note: "" },
    onSubmit: async ({ value }) => {
      const run = await launch({
        issue_id: issue.id,
        base_branch: target.baseBranch,
        ...contextRequestFields({ references, note: value.note }),
        ...launchExecution.request,
      });
      if (run) onLaunched(run);
    },
  });
  const note = useStore(form.store, (state) => state.values.note);
  const sources = useContextSources({
    draft: { references, note },
    issue,
    agentChoice: launchExecution.selection.agent,
    profiles: launchExecution.agents.profiles,
  });

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        <LaunchComposer
          issue={issue}
          target={target}
          references={references}
          onReferencesChange={setReferences}
          execution={launchExecution}
          onExecutionChange={onExecutionChange}
          label={COMPOSER_LABEL}
          action={LAUNCH_ACTION}
          unavailableReason={unavailableReason(isPending, launchExecution.canLaunch)}
          pending={isPending}
          onSubmit={() => void form.handleSubmit()}
        >
          <form.Field name="note">
            {(field) => (
              <AutoTextarea
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Anything the attached context and the agent’s own guidance do not already say"
                aria-label={`${COMPOSER_LABEL} instructions`}
              />
            )}
          </form.Field>
        </LaunchComposer>
        <ContextSourcesPanel sources={sources} />
      </DialogBody>
      <IssueFormFooter onCancel={onCancel} />
    </>
  );
}
