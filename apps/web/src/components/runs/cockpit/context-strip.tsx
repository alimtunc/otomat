import type { RunDetail } from "@otomat/domain";
import { Button, Icon, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useAbortRun, useResumeRun } from "@web/api/runs/mutations";
import { canAbortRun, canResumeRun } from "@web/lib/run-actions";

/** Compact single-row replacement for the context rail on narrow cockpit widths. */
export function ContextStrip({ detail }: { detail: RunDetail }) {
  const runId = detail.run.id;
  const status = detail.run.status;
  const abort = useAbortRun(runId);
  const resume = useResumeRun(runId);

  return (
    <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border-subtle bg-surface-1 px-3.5">
      <RunStatusChip status={status} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-tertiary">
        {detail.run.branch}
      </span>
      <Button
        size="sm"
        render={
          <Link to="/runs/$runId/diff" params={{ runId }}>
            <Icon name="git-compare" aria-hidden />
            Diff
          </Link>
        }
      />
      {canResumeRun(status) ? (
        <Button
          size="sm"
          variant="outline"
          loading={resume.isPending}
          onClick={() => resume.mutate()}
        >
          Resume
        </Button>
      ) : null}
      {canAbortRun(status) ? (
        <Button
          size="sm"
          variant="destructive"
          loading={abort.isPending}
          onClick={() => abort.mutate()}
        >
          <Icon name="square" aria-hidden />
          Stop
        </Button>
      ) : null}
    </div>
  );
}
