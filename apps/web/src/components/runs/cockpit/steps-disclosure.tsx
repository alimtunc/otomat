import type { RunDetail } from "@otomat/domain";
import { Button, cn, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { StepsList } from "@web/components/runs/cockpit/steps-list";
import { FOCUS_RING } from "@web/lib/focus";

export function StepsDisclosure({ detail }: { detail: RunDetail }) {
  const stepCount = detail.run.plan_json.steps.length;
  return (
    <Collapsible className="flex-none border-b border-border-subtle bg-sidebar">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "group h-8.5 w-full justify-start rounded-none px-3.5 text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary hover:text-foreground",
              FOCUS_RING,
            )}
          />
        }
      >
        <Icon
          name="chevron-down"
          aria-hidden
          className="h-3.5 w-3.5 group-data-[closed]:-rotate-90"
        />
        Steps &amp; sessions
        <span className="ml-auto font-mono text-[10px] font-normal">
          {stepCount === 1 ? "1 step" : `${stepCount} steps`}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="max-h-72 overflow-auto border-t border-border-subtle">
        <StepsList detail={detail} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
