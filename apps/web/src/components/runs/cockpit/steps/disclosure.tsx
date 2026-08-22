import type { EventEnvelope, RunDetail } from "@otomat/domain";
import {
  Button,
  cn,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  FOCUS_RING,
  Icon,
} from "@otomat/ui";
import { StepsList } from "@web/components/runs/cockpit/steps/list";
import { useStepActivity } from "@web/components/runs/cockpit/steps/use-step-activity";

export function StepsDisclosure({
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
  const stepCount = detail.run.plan_json.steps.length;
  const hasNewActivity = useStepActivity(events, selectedStepId);
  return (
    <Collapsible className="group/steps flex-none border-b border-border-subtle bg-sidebar">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8.5 w-full justify-start rounded-none px-3.5 text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary hover:text-foreground",
              FOCUS_RING,
            )}
          />
        }
      >
        <Icon
          name="chevron-down"
          aria-hidden
          className="h-3.5 w-3.5 group-data-[closed]/steps:-rotate-90"
        />
        Steps &amp; sessions
        <span className="ml-auto font-mono text-[10px] font-normal">
          {stepCount === 1 ? "1 step" : `${stepCount} steps`}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="max-h-72 overflow-auto border-t border-border-subtle">
        <StepsList
          detail={detail}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          hasNewActivity={hasNewActivity}
        />
      </CollapsiblePanel>
    </Collapsible>
  );
}
