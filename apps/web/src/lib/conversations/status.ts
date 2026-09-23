import type { ConversationEntry, StepRunState } from "@otomat/domain";

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

export function conversationStatus(entries: readonly ConversationEntry[]): StepRunState | null {
  const statuses = entries.map((entry) => {
    if (entry.pending_interaction === null) return entry.step_status;
    return entry.pending_interaction.kind === "permission"
      ? "awaiting_permission"
      : "awaiting_human";
  });
  return STATUS_PRIORITY.find((status) => statuses.includes(status)) ?? null;
}
