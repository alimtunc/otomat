import type { RunState } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useAbortRun, useResumeRun } from "@web/api/runs/mutations";
import { canAbortRun, canResumeRun } from "@web/lib/run-actions";

export interface RunActionButtonsProps {
  runId: string;
  status: RunState;
  stretch?: boolean;
}

export function RunActionButtons({ runId, status, stretch = false }: RunActionButtonsProps) {
  const abort = useAbortRun(runId);
  const resume = useResumeRun(runId);
  const className = stretch ? "flex-1" : undefined;

  return (
    <>
      <Button
        size="sm"
        className={className}
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
          className={className}
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
          className={className}
          loading={abort.isPending}
          onClick={() => abort.mutate()}
        >
          <Icon name="square" aria-hidden />
          Stop
        </Button>
      ) : null}
    </>
  );
}
