import type { EventEnvelope, RunDetail } from "@otomat/domain";
import { SidePanelToggle } from "@otomat/ui";
import { StepsList } from "@web/components/runs/cockpit/steps/list";
import { useStepActivity } from "@web/components/runs/cockpit/steps/use-step-activity";
import { PaneHeader } from "@web/components/runs/pane-header";

export function StepsPane({
  detail,
  events,
  selectedStepId,
  onSelectStep,
}: {
  detail: RunDetail;
  events: readonly EventEnvelope[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}) {
  const hasNewActivity = useStepActivity(events, selectedStepId);
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-sidebar">
      <PaneHeader className="bg-sidebar">
        Steps &amp; sessions
        <SidePanelToggle className="-mr-1.5 ml-auto" />
      </PaneHeader>
      <StepsList
        detail={detail}
        selectedStepId={selectedStepId}
        onSelectStep={onSelectStep}
        hasNewActivity={hasNewActivity}
      />
    </div>
  );
}
