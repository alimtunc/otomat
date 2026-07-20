import type { RunDetail } from "@otomat/domain";
import { Button, Icon, RunStatusChip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useAbortRun, useResumeRun } from "@web/api/runs/mutations";
import { PaneHeader } from "@web/components/runs/pane-header";
import { canAbortRun, canResumeRun } from "@web/lib/run-actions";

export function ContextPane({ detail }: { detail: RunDetail }) {
  const runId = detail.run.id;
  const status = detail.run.status;
  const abort = useAbortRun(runId);
  const resume = useResumeRun(runId);

  const canAbort = canAbortRun(status);
  const canResume = canResumeRun(status);

  return (
    <div className="min-h-0 min-w-0 overflow-auto border-l border-border-subtle">
      <PaneHeader>Run context</PaneHeader>
      <div className="p-4">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 rounded-lg border border-border-subtle bg-surface-1 p-3.5 text-sm">
          <dt className="text-xs text-text-tertiary">state</dt>
          <dd className="m-0 justify-self-end">
            <RunStatusChip status={status} />
          </dd>
          <dt className="text-xs text-text-tertiary">branch</dt>
          <dd className="m-0 min-w-0 justify-self-end truncate font-mono text-xs text-foreground">
            {detail.run.branch}
          </dd>
        </dl>
        <div className="mt-3.5 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            render={
              <Link to="/runs/$runId/diff" params={{ runId }}>
                <Icon name="git-compare" aria-hidden />
                Diff
              </Link>
            }
          />
          {canResume ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
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
              className="flex-1"
              loading={abort.isPending}
              onClick={() => abort.mutate()}
            >
              <Icon name="square" aria-hidden />
              Stop
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
