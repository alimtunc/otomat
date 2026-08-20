import { isProviderProvedResume } from "@otomat/domain";
import { Button, Icon, RelativeTime } from "@otomat/ui";
import { useResumeRun, useScheduleProviderResume } from "@web/api/runs/mutations";
import { ProviderWaitScheduleDialog } from "@web/components/runs/provider-wait/schedule-dialog";
import type { ProviderWaitTarget } from "@web/lib/run/provider-wait";
import { useState } from "react";

export interface ProviderWaitPanelProps {
  runId: string;
  target: ProviderWaitTarget;
}

/** The suspended step where the operator meets it: what the provider said, when Otomat will pick the work back up, and every way to change that. */
export function ProviderWaitPanel({ runId, target }: ProviderWaitPanelProps) {
  const [scheduleOpenedAt, setScheduleOpenedAt] = useState<string | null>(null);
  const resume = useResumeRun(runId);
  const schedule = useScheduleProviderResume(runId);
  const { wait } = target;
  const proved = wait.provider_resume_at;
  const busy = resume.isPending || schedule.isPending;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-xs leading-relaxed text-text-secondary">
        {wait.provider} stopped “{target.step.name}” on a quota limit. The branch, the worktree and
        the agent’s own session are all still there — resuming continues that same work.
      </p>
      <p className="m-0 rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-text-tertiary">
        {wait.reason}
      </p>
      {wait.resume_at === null ? (
        <p className="m-0 text-xs text-warning">
          No resume scheduled. Otomat never invents a reset time — pick one and it resumes on its
          own, even with the desktop closed.
        </p>
      ) : (
        <p className="m-0 text-xs text-text-secondary">
          Resumes <RelativeTime date={wait.resume_at} className="text-text-primary" /> ·{" "}
          {isProviderProvedResume(wait) ? "reset time reported by the provider" : "time you picked"}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          loading={resume.isPending}
          onClick={() => resume.mutate()}
        >
          <Icon name="play" aria-hidden />
          Resume now
        </Button>
        {wait.resume_at === null && proved !== null && proved > new Date().toISOString() ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => schedule.mutate(proved)}
          >
            <Icon name="timer" aria-hidden />
            Resume when available
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setScheduleOpenedAt(new Date().toISOString())}
        >
          <Icon name="timer" aria-hidden />
          Change schedule…
        </Button>
        {wait.resume_at === null ? null : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => schedule.mutate(null)}>
            <Icon name="x" aria-hidden />
            Cancel scheduled resume
          </Button>
        )}
      </div>
      {scheduleOpenedAt === null ? null : (
        <ProviderWaitScheduleDialog
          runId={runId}
          wait={wait}
          openedAt={scheduleOpenedAt}
          onClose={() => setScheduleOpenedAt(null)}
        />
      )}
    </div>
  );
}
