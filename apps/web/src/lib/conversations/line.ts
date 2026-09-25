import type { ConversationThreadEntry as ConversationEntry } from "@otomat/domain";

const INTERACTION_LABEL = {
  permission: "Permission",
  choice: "Choice",
  text: "Question",
  questionnaire: "Questions",
} as const;

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "") ?? "";
}

/** One line to orient by: a question outranks a waiting message, which outranks the last thing said. */
export function conversationLine(entry: ConversationEntry): string {
  if ("terminal" in entry) return `${entry.terminal.tool ?? "Shell"} · ${entry.terminal.branch}`;
  if (entry.pending_interaction !== null) {
    const label = INTERACTION_LABEL[entry.pending_interaction.kind];
    return `${label}: ${firstLine(entry.pending_interaction.prompt)}`;
  }
  if (entry.queued_contributions > 0) {
    const noun = entry.queued_contributions === 1 ? "message" : "messages";
    return `${entry.queued_contributions} ${noun} queued · delivers on the next turn`;
  }
  if (entry.last === null) return "No message yet";
  const first = firstLine(entry.last.text);
  return entry.last.kind === "user" ? `You: ${first}` : first;
}
