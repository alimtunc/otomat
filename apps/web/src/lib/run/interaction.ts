import { DaemonRequestError } from "@otomat/client";
import {
  answerRunInteractionErrorSchema,
  type RunInteractionContract,
  type RuntimeInteractionAnswer,
} from "@otomat/domain";
import type { StatusTone } from "@otomat/ui";

const STATE_TONE = {
  pending: "warning",
  answered: "success",
  canceled: "stale",
} satisfies Record<RunInteractionContract["state"], StatusTone>;

const STATE_LABEL = {
  pending: "Waiting for you",
  answered: "Answered",
  canceled: "No longer answerable",
} satisfies Record<RunInteractionContract["state"], string>;

export function interactionStateTone(state: RunInteractionContract["state"]): StatusTone {
  return STATE_TONE[state];
}

export function interactionStateLabel(state: RunInteractionContract["state"]): string {
  return STATE_LABEL[state];
}

export function interactionAnswerLabel(answer: RuntimeInteractionAnswer): string {
  if (answer.kind === "permission") return answer.decision === "allow" ? "Approved" : "Refused";
  if (answer.kind === "choice") return answer.values.join(", ");
  return answer.text;
}

/** A typed refusal reads verbatim: it is the daemon's own sentence about why the runtime can no longer take this answer. */
export function interactionErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = answerRunInteractionErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not answer — the daemon rejected the request.";
  }
  return "Could not answer — is the daemon running?";
}
