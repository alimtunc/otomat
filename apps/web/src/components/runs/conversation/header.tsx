import type { RunDetail } from "@otomat/domain";
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
import { useStopRunStep } from "@web/api/runs/step-mutations";
import { CodexPermissions } from "@web/components/runs/conversation/codex-permissions";
import { NextTurnModelDialog } from "@web/components/runs/conversation/next-turn/dialog";
import { agentLabel, modelLabel } from "@web/lib/execution/labels";
import { stepParticipant } from "@web/lib/run/participant";

export function ConversationHeader({
  detail,
  stepRunId,
}: {
  detail: RunDetail;
  stepRunId: string;
}) {
  const runtimes = useRuntimes();
  const stopStep = useStopRunStep(detail.run.id);
  const step = detail.steps.find((candidate) => candidate.id === stepRunId);
  const {
    session,
    launched,
    launchedConfig: current,
    pending,
  } = stepParticipant(detail, stepRunId);
  if (!step || current === null) return null;
  const live =
    step.status === "starting" ||
    step.status === "running" ||
    step.status === "awaiting_permission";
  const runtime = runtimes.data?.find(
    (descriptor) => descriptor.id === (launched?.agent_id ?? current.runtime),
  );
  const capability = runtime?.capabilities.resume_model;
  const effort = current.options.effort ?? current.options.reasoning_effort;
  const requestedModel = modelLabel(current.model);
  const reportedModel = launched?.reported_model ?? null;
  const effectiveModel = reportedModel ?? requestedModel;
  const requestedBy = `Requested by ${current.sources?.model ?? "step"}${effort ? ` · effort ${effort}` : ""}`;
  const diverged =
    current.model !== null && reportedModel !== null && reportedModel !== current.model.id;
  let fallback = { label: "Model change unavailable · Add follow-up step", title: "" };
  if (capability?.status === "unsupported") {
    fallback = { ...fallback, title: capability.reason };
  } else if (runtimes.isPending) {
    fallback = { label: "Checking model support…", title: "Checking runtime capabilities…" };
  } else {
    fallback = { ...fallback, title: "This participant has no resumable provider session." };
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2 [overflow-wrap:anywhere]">
      <StepStatusChip status={step.status} />
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
      <Popover>
        <PopoverTrigger
          render={
            <IconButton
              label="Session details"
              icon={<Icon name="info" aria-hidden />}
              className={live ? undefined : "ml-auto"}
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
          {capability?.status === "supported" && session?.provider_session_id ? (
            <NextTurnModelDialog
              key={pending?.config_hash ?? current.config_hash}
              runId={detail.run.id}
              stepId={stepRunId}
              sessionId={session.id}
              config={pending ?? session.config ?? current}
            />
          ) : (
            <div>
              <p>{fallback.label}</p>
              <p className="mt-1 text-text-tertiary">{fallback.title}</p>
            </div>
          )}
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
