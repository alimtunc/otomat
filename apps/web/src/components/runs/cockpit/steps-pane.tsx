import type { RunDetail } from "@otomat/domain";
import { StepsList } from "@web/components/runs/cockpit/steps-list";
import { PaneHeader } from "@web/components/runs/pane-header";

export function StepsPane({ detail }: { detail: RunDetail }) {
  return (
    <div className="min-h-0 min-w-0 overflow-auto border-r border-border-subtle bg-sidebar">
      <PaneHeader className="bg-sidebar">Steps &amp; sessions</PaneHeader>
      <StepsList detail={detail} />
    </div>
  );
}
