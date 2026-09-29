import { isStepBusy, liveStepStatus, type RunDetail } from "@otomat/domain";
import {
  Badge,
  Button,
  Icon,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StepStatusChip,
} from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { useRunInteractions } from "@web/api/runs/queries";
import { useStopRunStep } from "@web/api/runs/step-mutations";
import { CancelStepButton } from "@web/components/runs/cockpit/steps/cancel-step-button";
import { CodexPermissions } from "@web/components/runs/conversation/codex-permissions";
import { agentLabel, modelLabel } from "@web/lib/execution/labels";
import { effortValue } from "@web/lib/provider-options";
import { stepParticipant } from "@web/lib/run/participant";

export function ConversationHeader({
  detail,
  stepRunId,
}: {
  detail: RunDetail;
  stepRunId: string;
}) {
  const runtimes = useRuntimes();
  const interactions = useRunInteractions(detail.run.id);
  const stopStep = useStopRunStep(detail.run.id);
  const step = detail.steps.find((candidate) => candidate.id === stepRunId);
  const {
    session,
    launched,
    launchedConfig: current,
    pending,
  } = stepParticipant(detail, stepRunId);
  if (!step || current === null) return null;
  const asking =
    interactions.data?.interactions.some(
      (interaction) => interaction.step_run_id === stepRunId && interaction.state === "pending",
    ) === true;
  const status = liveStepStatus(step.status, session?.status ?? null, asking);
  const live = isStepBusy(status);
  const cancelable = step.status === "queued" && step.compete_group_id === null;
  const runtime = runtimes.data?.find(
    (descriptor) => descriptor.id === (launched?.agent_id ?? current.runtime),
  );
  const effort = effortValue(current.options);
  const requestedModel = modelLabel(current.model);
  const reportedModel = launched?.reported_model ?? null;
  const effectiveModel = reportedModel ?? requestedModel;
  const requestedBy = `Requested by ${current.sources?.model ?? "step"}${effort ? ` · effort ${effort}` : ""}`;
  const diverged =
    current.model !== null && reportedModel !== null && reportedModel !== current.model.id;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2 [overflow-wrap:anywhere]">
      <StepStatusChip status={status} />
      <span className="text-xs font-medium text-foreground">
        {agentLabel(current)} · {runtime?.display_name ?? current.runtime}
      </span>
      <span className="text-xs text-text-secondary" title={requestedBy}>
        {effectiveModel}
        {effort ? ` · ${effort}` : ""}
      </span>
      {diverged ? (
        <span className="text-xs text-warning" title="The provider reported a different model.">
          Model differs from request
        </span>
      ) : null}
      {pending === null ? null : (
        <Badge variant="iris">Next turn: {modelLabel(pending.model)}</Badge>
      )}
      {live ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto"
          disabled={stopStep.isPending}
          loading={stopStep.isPending}
          onClick={() => stopStep.mutate(stepRunId)}
        >
          <Icon name="square" aria-hidden />
          Stop step
        </Button>
      ) : null}
      {cancelable ? (
        <CancelStepButton runId={detail.run.id} stepId={stepRunId} className="ml-auto" />
      ) : null}
      <Popover>
        <PopoverTrigger
          render={
            <IconButton
              label="Session details"
              icon={<Icon name="info" aria-hidden />}
              className={live || cancelable ? undefined : "ml-auto"}
            />
          }
        />
        <PopoverContent
          align="end"
          className="flex max-w-96 flex-col gap-3 p-3 text-xs text-text-secondary"
        >
          <p>
            Requested: {requestedModel} · Reported: {reportedModel ?? "not reported"}
          </p>
          <p>{requestedBy}</p>
        </PopoverContent>
      </Popover>
      {current.runtime === "codex" ? (
        <div className="basis-full">
          <CodexPermissions options={current.options} />
        </div>
      ) : null}
    </div>
  );
}
