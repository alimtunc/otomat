import { isRunResumable, isRunSettled } from "@otomat/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";
import { useAbortRun, useResumeRun } from "@web/api/runs/mutations";
import { useRunDetail } from "@web/api/runs/queries";
import { AbandonWorkspaceDialog } from "@web/components/runs/actions/abandon-workspace-dialog";
import { canAbortRun } from "@web/lib/run/actions";
import { resumeModeNote } from "@web/lib/run/resume-mode";
import { useState } from "react";

export interface RunActionsMenuProps {
  runId: string;
  stretch?: boolean;
}

/** The daemon's own view of the run decides what is offered, so the cockpit never shows an action it would refuse. */
export function RunActionsMenu({ runId, stretch = false }: RunActionsMenuProps) {
  const [abandoning, setAbandoning] = useState(false);
  const detail = useRunDetail(runId).data;
  const abort = useAbortRun(runId);
  const resume = useResumeRun(runId);

  const cancelable = detail !== undefined && canAbortRun(detail.run.status);

  return (
    <>
      {detail !== undefined && isRunResumable(detail.run.status) ? (
        <Button
          size="sm"
          variant={isRunSettled(detail.run.status) ? "primary" : "outline"}
          className={stretch ? "flex-1" : undefined}
          title={resumeModeNote(detail.resume)}
          loading={resume.isPending}
          disabled={detail.resume.mode === "unavailable" || resume.isPending}
          onClick={() => resume.mutate()}
        >
          <Icon name="refresh-cw" aria-hidden />
          Resume run
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<IconButton label="Run actions" icon={<Icon name="more-horizontal" />} />}
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!cancelable || abort.isPending}
            onClick={() => abort.mutate()}
          >
            <Icon name="square" aria-hidden />
            Cancel run
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={detail?.holds_workspace !== true}
            onClick={() => setAbandoning(true)}
          >
            <Icon name="x" aria-hidden />
            Abandon workspace…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AbandonWorkspaceDialog runId={runId} open={abandoning} onOpenChange={setAbandoning} />
    </>
  );
}
