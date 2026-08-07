import type { RunDetail } from "@otomat/domain";
import { SidePanelToggle } from "@otomat/ui";
import { StepsList } from "@web/components/runs/cockpit/steps/list";
import { PaneHeader } from "@web/components/runs/pane-header";

export function StepsPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-sidebar">
      <PaneHeader className="bg-sidebar">
        Steps &amp; sessions
        <SidePanelToggle className="-mr-1.5 ml-auto" />
      </PaneHeader>
      <StepsList detail={detail} />
    </div>
  );
}
