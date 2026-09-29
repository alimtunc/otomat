import type { ConversationThreadEntry } from "@otomat/domain";

export interface ConversationThreadTarget {
  step?: string;
  terminal?: string;
}

export function findConversationThread(
  entries: readonly ConversationThreadEntry[],
  target: ConversationThreadTarget,
): ConversationThreadEntry | undefined {
  return entries.find((entry) =>
    "terminal" in entry ? entry.terminal.id === target.terminal : entry.step_run_id === target.step,
  );
}
