import type { ConversationThreadEntry, StepRunState } from "@otomat/domain";

const STATUS_PRIORITY: readonly StepRunState[] = [
  "awaiting_permission",
  "awaiting_human",
  "waiting_for_provider",
  "failed",
  "stale",
  "running",
  "starting",
  "queued",
];

export function conversationStatus(
  entries: readonly ConversationThreadEntry[],
): StepRunState | null {
  const statuses = entries
    .filter((entry) => "step_status" in entry)
    .map((entry) => {
      if (entry.pending_interaction === null) return entry.step_status;
      return entry.pending_interaction.kind === "permission"
        ? "awaiting_permission"
        : "awaiting_human";
    });
  return STATUS_PRIORITY.find((status) => statuses.includes(status)) ?? null;
}

export function isConversationRunning(entry: ConversationThreadEntry): boolean {
  return "terminal" in entry ? entry.terminal.state !== "exited" : entry.step_status === "running";
}

export function isConversationWaiting(entry: ConversationThreadEntry): boolean {
  const status = conversationStatus([entry]);
  return status === "awaiting_permission" || status === "awaiting_human";
}
