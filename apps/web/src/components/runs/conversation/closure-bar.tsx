import { isRunResumable, type RunDetail } from "@otomat/domain";
import { Button, Icon, StatusGlyph } from "@otomat/ui";
import { useResumeRun } from "@web/api/runs/mutations";
import { AddStepDialog } from "@web/components/runs/actions/add-step-dialog";
import { NextTurnMenu } from "@web/components/runs/conversation/next-turn/menu";
import { settledRunNote } from "@web/lib/run/contribution";
import { resumeModeNote, resumeReopensStep } from "@web/lib/run/resume-mode";

export function RunClosureBar({ detail, stepRunId }: { detail: RunDetail; stepRunId: string }) {
  const resume = useResumeRun(detail.run.id);
  const resumable = isRunResumable(detail.run.status);
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border-subtle p-3 [overflow-wrap:anywhere]">
      <div className="flex items-start gap-2.5">
        <StatusGlyph kind="run" status={detail.run.status} />
        <p role="status" className="min-w-0 flex-1 text-xs text-text-secondary">
          {settledRunNote(detail.run.status)}
          {resumable ? ` ${resumeModeNote(detail.resume)}` : null}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {resumeReopensStep(detail.resume, stepRunId) ? (
          <NextTurnMenu key={stepRunId} detail={detail} stepRunId={stepRunId} />
        ) : null}
        <span className="ml-auto flex flex-wrap gap-1.5">
          <AddStepDialog issueId={detail.run.issue_id} />
          {resumable ? (
            <Button
              size="xs"
              variant="primary"
              loading={resume.isPending}
              disabled={detail.resume.mode === "unavailable" || resume.isPending}
              onClick={() => resume.mutate()}
            >
              <Icon name="refresh-cw" aria-hidden />
              Resume run
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
