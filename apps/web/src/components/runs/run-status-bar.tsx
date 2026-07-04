import { isRunTerminal, type RunDetail } from "@otomat/domain";
import { Button, RunStatusChip, SessionStatusChip, StepStatusChip } from "@otomat/ui";
import { useAbortRun, useResumeRun } from "@web/api/runs/mutations";

export function RunStatusBar({ detail }: { detail: RunDetail }) {
  const runId = detail.run.id;
  const status = detail.run.status;
  const abort = useAbortRun(runId);
  const resume = useResumeRun(runId);

  // Mirrors the daemon's abort guard, minus review_ready: its completed marker is honored, so abort would be a silent no-op.
  const canAbort = !isRunTerminal(status) && status !== "review_ready";
  const canResume = status === "awaiting_human";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-6 py-3">
      <RunStatusChip status={status} />
      {detail.steps.map((step) => (
        <StepStatusChip key={step.id} status={step.status} />
      ))}
      {detail.sessions.map((session) => (
        <SessionStatusChip key={session.id} status={session.status} />
      ))}
      <div className="ml-auto flex items-center gap-2">
        {canResume ? (
          <Button
            size="sm"
            variant="outline"
            loading={resume.isPending}
            onClick={() => resume.mutate()}
          >
            Resume
          </Button>
        ) : null}
        {canAbort ? (
          <Button
            size="sm"
            variant="destructive"
            loading={abort.isPending}
            onClick={() => abort.mutate()}
          >
            Abort
          </Button>
        ) : null}
      </div>
    </div>
  );
}
