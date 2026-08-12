import type { StepRunRow } from "@otomat/db";
import type { EventEnvelope } from "@otomat/domain";

import type { CanonicalDiff } from "#git";
import { asString } from "#runtime";

/** Keeps a recovery prompt readable when a run stopped after a long transcript. */
const MAX_EXCERPT_CHARS = 4_000;
const MAX_FAILURE_LINES = 20;

export interface RecoveryPromptInput {
  issueTitle: string;
  issueBody: string | null;
  branch: string;
  /** Plan step the recovery session reopens; the rest of the plan is context. */
  stepName: string;
  stepPrompt: string | null;
  steps: readonly StepRunRow[];
  /** The stopped run's ledger, newest evidence last. */
  events: readonly EventEnvelope[];
  /** Null when the worktree is gone; the prompt then says so rather than implying a clean tree. */
  diff: CanonicalDiff | null;
  uncommittedFiles: number;
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

function renderPlan(steps: readonly StepRunRow[], stepName: string): string[] {
  if (steps.length === 0) return ["Plan: this run has no recorded steps."];
  return [
    "Plan so far:",
    ...steps.map((step) => {
      const marker = step.name === stepName ? " ← you are resuming this step" : "";
      return `- ${step.name}: ${step.status}${marker}`;
    }),
  ];
}

function renderGitState(input: RecoveryPromptInput): string[] {
  if (input.diff === null) {
    return [`Git: on branch ${input.branch}; the worktree diff is unavailable.`];
  }
  const { diff } = input;
  const files = diff.files.map((file) => `- ${file.path} +${file.additions} -${file.deletions}`);
  return [
    `Git: on branch ${input.branch}, ${input.uncommittedFiles} uncommitted file(s).`,
    `Diff ${diff.sha} against ${diff.base} (+${diff.additions} -${diff.deletions}):`,
    ...(files.length === 0 ? ["- (no file changed yet)"] : files),
  ];
}

/** The durable context a recovery session needs because a fresh provider conversation inherits nothing; a native resume never uses this. */
export function buildRecoveryPrompt(input: RecoveryPromptInput): string {
  const lastMessage = lastAgentMessage(input.events);
  return [
    `The previous session on branch ${input.branch} stopped before finishing. You are`,
    "continuing that same work in the same worktree, with a new session that has none",
    "of its context. Re-read the worktree before changing anything.",
    "",
    `Goal: ${input.issueTitle}`,
    ...(input.issueBody ? ["", input.issueBody] : []),
    "",
    ...renderPlan(input.steps, input.stepName),
    "",
    `Step to finish: ${input.stepName}`,
    ...(input.stepPrompt ? ["", input.stepPrompt] : []),
    "",
    ...renderGitState(input),
    "",
    "How the previous session ended:",
    failureExcerpt(input.events),
    "",
    ...(lastMessage ? ["Its last message:", lastMessage, ""] : []),
    "Continue from there.",
  ].join("\n");
}
