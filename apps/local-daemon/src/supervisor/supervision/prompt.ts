import type { StepRunRow } from "@otomat/db";
import {
  collectReportedCommands,
  type DeliveryExpectation,
  type EventEnvelope,
  type SupervisionDecision,
} from "@otomat/domain";

import type { CanonicalDiff } from "#git";

export interface SupervisionBrief {
  step: StepRunRow;
  expectation: DeliveryExpectation;
  /** Null when the step's trees could not be read; the supervisor is told so rather than shown an empty diff. */
  diff: CanonicalDiff | null;
  events: readonly EventEnvelope[];
  /** What earlier rounds already asked of this step, so the supervisor judges the answer and not the question again. */
  history: readonly SupervisionDecision[];
  pendingQuestions: number;
}

const CONTRACT = {
  standard: "standard — no particular delivery shape was declared.",
  implementation:
    "implementation required — the step had to change the workspace, not only describe what to change.",
  analysis: "analysis — this step was declared not to change code; an empty diff is expected.",
} satisfies Record<DeliveryExpectation, string>;

function describeDiff(diff: CanonicalDiff | null): string {
  if (diff === null) return "The workspace delta could not be read.";
  if (diff.files.length === 0) return "No file changed between the step's start and its end.";
  const files = diff.files
    .map((file) => `- ${file.status} ${file.path} (+${file.additions} -${file.deletions})`)
    .join("\n");
  return `Base ${diff.base} → head ${diff.head}, ${diff.files.length} file(s):\n${files}`;
}

function describeCommands(events: readonly EventEnvelope[]): string {
  const commands = collectReportedCommands(events);
  if (commands.length === 0) return "No command execution was observed for this step.";
  return commands.map((command) => `- [${command.outcome}] ${command.command}`).join("\n");
}

function describeHistory(history: readonly SupervisionDecision[]): string {
  if (history.length === 0) return "This is the first round for this step.";
  return history
    .map((decision, index) => `- Round ${index + 1}: ${decision.decision} — ${decision.reason}`)
    .join("\n");
}

/** Everything the daemon itself observed, and nothing the step said about itself. */
export function buildSupervisionPrompt(brief: SupervisionBrief): string {
  return [
    "# Supervision",
    "",
    `Judge whether the step "${brief.step.name}" delivered what it owed.`,
    "",
    "## Declared contract",
    CONTRACT[brief.expectation],
    "",
    "## Observed workspace delta",
    describeDiff(brief.diff),
    "",
    "## Observed commands",
    describeCommands(brief.events),
    "",
    "## Unanswered questions at the end of the turn",
    String(brief.pendingQuestions),
    "",
    "## Earlier rounds",
    describeHistory(brief.history),
    "",
    "## Your answer",
    "Read the workspace if you need more than the facts above. Then end your reply with one",
    "fenced JSON block and nothing after it:",
    "",
    "```json",
    '{ "decision": "pass" | "needs_changes" | "blocked", "reason": "one sentence",',
    '  "instructions": "required only for needs_changes: what the step must do next" }',
    "```",
    "",
    "`pass` releases the steps that wait on this one. `needs_changes` sends your instructions",
    "back to this same step for another turn. `blocked` stops the run for a human. Without a",
    "readable block nothing is released.",
  ].join("\n");
}
