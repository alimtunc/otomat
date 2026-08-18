import { isRunResumable, type RunDetail } from "@otomat/domain";
import { SidePanelToggle } from "@otomat/ui";
import { RunActionButtons } from "@web/components/runs/cockpit/run/action-buttons";
import { RunFacts } from "@web/components/runs/cockpit/run/facts";
import { PaneHeader } from "@web/components/runs/pane-header";
import { resumeModeNote } from "@web/lib/run/resume-mode";

export function ContextPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <PaneHeader>
        Run context
        <SidePanelToggle className="-mr-1.5 ml-auto" />
      </PaneHeader>
      <div className="min-w-0 p-4">
        <RunFacts detail={detail} />
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
