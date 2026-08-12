import { isRunResumable, type RunDetail } from "@otomat/domain";
import { RunStatusChip, SidePanelToggle } from "@otomat/ui";
import { RunActionButtons } from "@web/components/runs/cockpit/run-action-buttons";
import { PaneHeader } from "@web/components/runs/pane-header";
import { resumeModeNote } from "@web/lib/run/resume-mode";

export function ContextPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <PaneHeader>
        Run context
        <SidePanelToggle className="-mr-1.5 ml-auto" />
      </PaneHeader>
      <div className="p-4">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.25 rounded-lg border border-border-subtle bg-surface-1 p-3.5 text-sm">
          <dt className="text-xs text-text-tertiary">state</dt>
          <dd className="m-0 justify-self-end">
            <RunStatusChip status={detail.run.status} />
          </dd>
          <dt className="text-xs text-text-tertiary">branch</dt>
          <dd className="m-0 min-w-0 justify-self-end truncate font-mono text-xs text-foreground">
            {detail.run.branch}
          </dd>
        </dl>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <RunActionButtons runId={detail.run.id} issueId={detail.run.issue_id} stretch />
        </div>
        {isRunResumable(detail.run.status) ? (
          <p className="mt-2.5 text-xs text-text-tertiary">{resumeModeNote(detail.resume)}</p>
        ) : null}
      </div>
    </div>
  );
}
