import type { EventEnvelope } from "@otomat/domain";

import { asString } from "#runtime";

/** Keeps a recovery brief readable when a run stopped after a long transcript. */
const MAX_EXCERPT_CHARS = 4_000;
const MAX_FAILURE_LINES = 20;

export interface RecoveryPromptInput {
  /** Plan step the recovery session reopens; its context and the cycle's state ride on the session's dossier. */
  stepName: string;
  /** The stopped run's ledger, newest evidence last. */
  events: readonly EventEnvelope[];
}

function truncate(text: string): string {
  if (text.length <= MAX_EXCERPT_CHARS) return text;
  return `…\n${text.slice(-MAX_EXCERPT_CHARS)}`;
}

/** The agent's own last words, so a recovery session does not repeat work the transcript already shows. Reasoning frames are skipped: they are not what the agent said it did. */
function lastAgentMessage(events: readonly EventEnvelope[]): string | null {
  const message = events.findLast(
    (event) => event.type === "runtime.message" && event.payload["thinking"] !== true,
  );
  if (!message) return null;
  const text = asString(message.payload["text"]);
  return text === null || text.trim() === "" ? null : truncate(text);
}

/** What the provider or the supervisor actually said as the turn died; nothing is invented when the ledger is silent. */
function failureExcerpt(events: readonly EventEnvelope[]): string {
  const lines = events
    .filter((event) => event.type === "runtime.log" && event.payload["stream"] === "stderr")
    .map((event) => asString(event.payload["text"]))
    .filter((text): text is string => text !== null && text.trim() !== "");
  if (lines.length === 0) return "The ledger recorded no error output for the stopped turn.";
  return truncate(lines.slice(-MAX_FAILURE_LINES).join("\n"));
}

/** Why this session exists, for a fresh provider conversation that inherits nothing; a native resume never uses this. */
export function buildRecoveryPrompt(input: RecoveryPromptInput): string {
  const lastMessage = lastAgentMessage(input.events);
  return [
    `The previous session on step "${input.stepName}" stopped before finishing. You are`,
    "continuing that same work in the same worktree, with a new session that has none",
    "of its context.",
    "",
    "How the previous session ended:",
    failureExcerpt(input.events),
    ...(lastMessage ? ["", "Its last message:", lastMessage] : []),
    "",
    "Continue from there.",
  ].join("\n");
}
