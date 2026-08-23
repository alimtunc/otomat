import { Link } from "@tanstack/react-router";
import { useRunCompletionReport } from "@web/api/runs/queries";
import { executionFailure } from "@web/lib/run/execution-failure";

const OUTCOME_LABELS = {
  failed: "This run failed.",
  canceled: "This run was canceled.",
  interrupted: "This run was interrupted.",
} as const;

const UNREADABLE_OUTCOME =
  "The run's execution outcome could not be read, so this page cannot vouch for it. Publishing stays available.";

export function PullRequestExecutionNotice({ runId }: { runId: string }) {
  const report = useRunCompletionReport(runId);
  const failure = report.data ? executionFailure(report.data.report) : null;
  const unreadable = report.isError && report.data === undefined;
  if (failure === null && !unreadable) return null;
  const details =
    failure === null
      ? []
      : [
          failure.steps.map((step) => `${step.name} (${step.status})`).join(", "),
          ...failure.reasons,
        ].filter((line) => line !== "");

  return (
    <section
      role="status"
      className="flex flex-col gap-1.5 rounded-lg border border-warning/40 bg-warning-bg p-3 text-sm"
    >
      <p className="font-medium">
        {failure === null
          ? UNREADABLE_OUTCOME
          : `${OUTCOME_LABELS[failure.outcome]} You can still publish what its workspace holds.`}
      </p>
      {details.map((line) => (
        <p key={line} className="text-text-secondary">
          {line}
        </p>
      ))}
      <Link to="/runs/$runId/logs" params={{ runId }} className="self-start text-xs underline">
        Open the run logs
      </Link>
    </section>
  );
}
