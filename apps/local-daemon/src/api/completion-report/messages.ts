import type { listAgentSessionsForRun } from "@otomat/db";
import type { RunCompletionReport, RunState } from "@otomat/domain";

import { comparePersistedRows } from "./persisted-order.js";

function appendStateMessages(
  report: RunCompletionReport,
  sessions: ReturnType<typeof listAgentSessionsForRun>,
): void {
  if (report.run.status === "failed") {
    report.errors.push({
      code: "run_failed",
      message: "Run ended in the failed state.",
      evidence: report.run.evidence,
    });
  }
  for (const session of sessions
    .toSorted(comparePersistedRows)
    .filter((candidate) => candidate.status === "failed")) {
    const exit = session.exit_code === null ? "" : ` (exit ${session.exit_code})`;
    report.errors.push({
      code: "session_failed",
      message: `Session ${session.id} failed${exit}.`,
      evidence: [{ source: "timeline", seq: null }],
    });
  }
  for (const command of report.commands.filter((candidate) => candidate.outcome === "failed")) {
    report.errors.push({
      code: "command_failed",
      message: `Command failed: ${command.command}`,
      evidence: command.evidence,
    });
  }
  if (report.run.outcome === "interrupted") {
    report.notices.push({
      code: "run_interrupted",
      message: "Run was interrupted and is waiting for an explicit resume.",
      evidence: report.run.evidence,
    });
  }
}

function appendNextActions(report: RunCompletionReport): void {
  const runActions: Partial<Record<RunState, { code: string; message: string }>> = {
    awaiting_human: { code: "resume_run", message: "Resume the interrupted run when ready." },
    awaiting_permission: {
      code: "answer_permission",
      message: "Answer the pending permission request.",
    },
    awaiting_selection: {
      code: "select_candidate",
      message: "Select a competing candidate.",
    },
    review_ready: {
      code: "review_run",
      message: "Review the run and publish a pull request when ready.",
    },
  };
  const runAction = runActions[report.run.status];
  if (runAction) report.next_actions.push({ ...runAction, evidence: report.run.evidence });
  if (report.review.open_comments.length > 0) {
    report.next_actions.push({
      code: "resolve_reviews",
      message: `Resolve ${report.review.open_comments.length} open review comment(s).`,
      evidence: report.review.evidence,
    });
  }
  if (report.pull_request.error) {
    report.next_actions.push({
      code: "retry_pull_request",
      message: "Retry pull request publication after addressing its reported error.",
      evidence: report.pull_request.evidence,
    });
  }
  for (const write of report.linear.writes.filter((candidate) => candidate.status === "failed")) {
    report.next_actions.push({
      code: "retry_linear_write",
      message: `Retry the failed Linear ${write.kind} write.`,
      evidence: write.evidence,
    });
  }
}

export function appendReportMessages(
  report: RunCompletionReport,
  sessions: ReturnType<typeof listAgentSessionsForRun>,
): void {
  appendStateMessages(report, sessions);
  appendNextActions(report);
}
