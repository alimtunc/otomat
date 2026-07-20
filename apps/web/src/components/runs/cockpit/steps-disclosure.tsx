import type { RunDetail } from "@otomat/domain";
import { cn, Icon } from "@otomat/ui";
import { StepsList } from "@web/components/runs/cockpit/steps-list";
import { FOCUS_RING } from "@web/lib/focus";
import { useState } from "react";

export function StepsDisclosure({ detail }: { detail: RunDetail }) {
  const [open, setOpen] = useState(false);
  const stepCount = detail.run.plan_json.steps.length;
  return (
    <div className="flex-none border-b border-border-subtle bg-sidebar">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-8.5 w-full items-center gap-2 px-3.5 text-micro font-semibold uppercase tracking-[0.04em] text-text-tertiary hover:text-foreground",
          FOCUS_RING,
        )}
      >
        <Icon
          name="chevron-down"
          aria-hidden
          className={cn("h-3.5 w-3.5", !open && "-rotate-90")}
        />
        Steps &amp; sessions
        <span className="ml-auto font-mono text-[10px] font-normal">
          {stepCount === 1 ? "1 step" : `${stepCount} steps`}
        </span>
      </button>
      {open ? (
        <div className="max-h-72 overflow-auto border-t border-border-subtle">
          <StepsList detail={detail} />
        </div>
      ) : null}
    </div>
  );
}
