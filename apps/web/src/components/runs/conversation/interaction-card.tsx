import type { RunInteractionContract } from "@otomat/domain";
import { Button, Chip, RelativeTime } from "@otomat/ui";
import { useAnswerRunInteraction } from "@web/api/runs/interaction-mutations";
import { InteractionAnswerForm } from "@web/components/runs/conversation/interaction-answer-form";
import {
  interactionAnswerLabel,
  interactionErrorMessage,
  interactionStateLabel,
  interactionStateTone,
} from "@web/lib/run/interaction";

/** Only the controls the request's own kind asks for; a runtime that asked for a choice never gets an approval. */
export function InteractionCard({
  runId,
  interaction,
}: {
  runId: string;
  interaction: RunInteractionContract;
}) {
  const answer = useAnswerRunInteraction(runId, interaction.id);
  const pending = interaction.state === "pending";
  const inFlight = answer.isPending ? answer.variables : undefined;

  return (
    <li className="flex flex-col gap-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-secondary">Agent is asking</span>
        <RelativeTime date={interaction.requested_at} className="text-xs" />
        <Chip tone={interactionStateTone(interaction.state)}>
          {interactionStateLabel(interaction.state)}
        </Chip>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-card px-3 py-2">
        <p className="text-sm text-text-primary">{interaction.prompt}</p>
        {interaction.tool === null ? null : (
          <p className="text-micro text-text-tertiary">Tool: {interaction.tool}</p>
        )}
        {pending && interaction.kind === "permission" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="xs"
              disabled={answer.isPending}
              loading={inFlight?.kind === "permission" && inFlight.decision === "allow"}
              onClick={() => answer.mutate({ kind: "permission", decision: "allow" })}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={answer.isPending}
              loading={inFlight?.kind === "permission" && inFlight.decision === "deny"}
              onClick={() => answer.mutate({ kind: "permission", decision: "deny" })}
            >
              Refuse
            </Button>
          </div>
        ) : null}
        {pending && interaction.kind === "choice" ? (
          <div className="flex flex-wrap gap-2">
            {interaction.options.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="xs"
                disabled={answer.isPending}
                loading={inFlight?.kind === "choice" && inFlight.values.includes(option.value)}
                onClick={() => answer.mutate({ kind: "choice", values: [option.value] })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
        {pending && interaction.kind === "text" ? <InteractionAnswerForm answer={answer} /> : null}
        {interaction.answer === null ? null : (
          <p className="text-xs text-text-secondary">
            You answered: {interactionAnswerLabel(interaction.answer)}
          </p>
        )}
        {interaction.canceled_reason === null ? null : (
          <p className="text-xs text-text-tertiary">{interaction.canceled_reason}</p>
        )}
        {answer.error === null ? null : (
          <p className="text-xs text-danger">{interactionErrorMessage(answer.error)}</p>
        )}
      </div>
    </li>
  );
}
