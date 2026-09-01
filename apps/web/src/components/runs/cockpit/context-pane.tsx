import { isRunResumable, type RunDetail } from "@otomat/domain";
import { SidePanelToggle } from "@otomat/ui";
import { useRunPullRequest } from "@web/api/prs/queries";
import { RunActionButtons } from "@web/components/runs/cockpit/run/action-buttons";
import { RunFacts } from "@web/components/runs/cockpit/run/facts";
import { NextActionCard } from "@web/components/runs/next-action/card";
import { PaneHeader } from "@web/components/runs/pane-header";
import { ProviderWaitPanel } from "@web/components/runs/provider-wait/panel";
import { providerWaitTarget } from "@web/lib/run/provider-wait";
import { resumeModeNote } from "@web/lib/run/resume-mode";

export function ContextPane({ detail }: { detail: RunDetail }) {
  const waiting = providerWaitTarget(detail);
  const pullRequest = useRunPullRequest(detail.run.id);
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      <PaneHeader>
        Run context
        <SidePanelToggle className="-mr-1.5 ml-auto" />
      </PaneHeader>
      <div className="min-w-0 p-4">
        {waiting === null ? (
          <div className="mb-3.5">
            <NextActionCard detail={detail} pullRequest={pullRequest.data} />
          </div>
        ) : (
          <div className="mb-3.5 rounded-lg border border-warning/40 bg-surface-1 p-3.5">
            <ProviderWaitPanel runId={detail.run.id} target={waiting} />
          </div>
        )}
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
