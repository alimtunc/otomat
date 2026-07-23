import type { CompletionEvidence, RunCompletionReport } from "@otomat/domain";

function evidenceUrl(report: RunCompletionReport, evidence: CompletionEvidence): string {
  const run = encodeURIComponent(report.run.id);
  switch (evidence.source) {
    case "timeline":
      return `otomat://app/runs/${run}${evidence.seq === null ? "" : `#event-${evidence.seq}`}`;
    case "diff":
      return `otomat://app/runs/${run}/diff${
        evidence.file_path === null ? "" : `#diff-file-${encodeURIComponent(evidence.file_path)}`
      }`;
    case "review":
      return `otomat://app/runs/${run}/diff${
        evidence.comment_id === null ? "" : `#review-comment-${evidence.comment_id}`
      }`;
    case "pull_request":
      return evidence.url ?? `otomat://app/runs/${run}/pr`;
    case "linear":
      return `otomat://app/issues/${encodeURIComponent(report.run.issue_id)}#linear-write-${evidence.write_id}`;
  }
}

function evidenceLink(
  report: RunCompletionReport,
  label: string,
  evidence: CompletionEvidence,
): string {
  return `[${label}](${evidenceUrl(report, evidence)})`;
}

function renderSteps(report: RunCompletionReport): string[] {
  if (report.steps.length === 0) return ["- No persisted step was reported."];
  return report.steps.map((step) => {
    const runtime = step.runtime ?? "not reported";
    const sessions =
      step.provider_sessions.length > 0 ? step.provider_sessions.join(", ") : "not reported";
    return `- ${step.name} — ${step.status}; runtime: ${runtime}; provider session: ${sessions} (${evidenceLink(report, "timeline", step.evidence[0])})`;
  });
}

function renderDiff(report: RunCompletionReport): string[] {
  if (report.diff.state === "not_reported") return ["Diff: none reported"];
  if (report.diff.state === "unavailable") return ["Diff: unavailable"];
  if (report.diff.state === "no_changes") return ["Diff: no changes"];
  return [
    `Diff: ${report.diff.files.length} file(s), +${report.diff.additions ?? 0}/-${report.diff.deletions ?? 0}`,
    ...report.diff.files.map(
      (file) =>
        `- ${evidenceLink(report, file.path, file.evidence[0])} — ${file.status}, +${file.additions}/-${file.deletions}`,
    ),
  ];
}

function renderCommands(report: RunCompletionReport): string[] {
  if (report.commands.length === 0) return ["- No command or test was reported."];
  return report.commands.map((command) => {
    const exit = command.exit_code === null ? "" : ` (exit ${command.exit_code})`;
    return `- \`${command.command}\` — ${command.outcome}${exit} (${evidenceLink(report, "timeline", command.evidence[0])})`;
  });
}

function renderReview(report: RunCompletionReport): string[] {
  if (report.review.state === "not_reported") return ["Review: none reported"];
  if (report.review.open_comments.length === 0)
    return [`Review: ${report.review.state}; no open comments`];
  return [
    `Review: ${report.review.open_comments.length} open of ${report.review.total_comments}`,
    ...report.review.open_comments.map(
      (comment) =>
        `- ${evidenceLink(report, `${comment.file_path}:${comment.line}`, comment.evidence[0])} — ${comment.body}`,
    ),
  ];
}

function renderPullRequest(report: RunCompletionReport): string {
  const pullRequest = report.pull_request;
  if (pullRequest.state === "not_reported") return "Pull request: none reported";
  if (pullRequest.state === "unavailable") return "Pull request: unavailable";
  const label =
    pullRequest.number === null ? "Pull request" : `Pull request #${pullRequest.number}`;
  return `${evidenceLink(report, label, pullRequest.evidence[0])}: ${pullRequest.status ?? "not reported"}; publication: ${pullRequest.publication_status ?? "not reported"}${pullRequest.error ? `; error: ${pullRequest.error}` : ""}`;
}

function renderLinear(report: RunCompletionReport): string[] {
  if (report.linear.state === "not_reported") return ["Linear: none reported"];
  if (report.linear.state === "unavailable") return ["Linear: unavailable"];
  return report.linear.writes.map(
    (write) =>
      `- ${evidenceLink(report, `Linear ${write.kind}`, write.evidence[0])} — ${write.status}${write.detail ? `; ${write.detail}` : ""}${write.error ? `; error: ${write.error}` : ""}`,
  );
}

function renderMessages(
  report: RunCompletionReport,
  messages:
    | RunCompletionReport["errors"]
    | RunCompletionReport["notices"]
    | RunCompletionReport["next_actions"],
  empty: string,
): string[] {
  if (messages.length === 0) return [`- ${empty}`];
  return messages.map((message) => {
    const firstEvidence = message.evidence[0];
    return firstEvidence
      ? `- ${message.message} (${evidenceLink(report, "evidence", firstEvidence)})`
      : `- ${message.message}`;
  });
}

export function renderRunCompletionMarkdown(report: RunCompletionReport): string {
  const plan =
    report.plan.state === "reported"
      ? `Plan: ${report.plan.step_count ?? 0} step(s) reported`
      : "Plan: not reported (corrupt)";
  return [
    `# Run ${report.run.id}`,
    "",
    `Result: ${report.run.outcome}`,
    `State: ${report.run.status}${report.run.terminal ? " (terminal)" : ""}`,
    `Branch: \`${report.run.branch}\``,
    plan,
    "",
    "## Steps and runtimes",
    ...renderSteps(report),
    "",
    "## Files and diff",
    ...renderDiff(report),
    "",
    "## Commands and tests",
    ...renderCommands(report),
    "",
    "## Review",
    ...renderReview(report),
    "",
    "## Pull request and Linear",
    renderPullRequest(report),
    ...renderLinear(report),
    "",
    "## Errors and interruptions",
    ...renderMessages(report, [...report.errors, ...report.notices], "None reported."),
    "",
    "## Next actions",
    ...renderMessages(report, report.next_actions, "None reported."),
    "",
  ].join("\n");
}
