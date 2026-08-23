import { FOCUS_RING, Icon, Popover, PopoverContent, PopoverTrigger, cn } from "@otomat/ui";
import { useActivity } from "@web/api/activity/queries";
import { countPendingActivities } from "@web/components/shell/activity/groups";
import { ActivityPanel } from "@web/components/shell/activity/panel";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useState } from "react";

const BADGE_CAP = 9;

export interface ActivityCenterProps {
  hostLabel: string;
}

export function ActivityCenter({ hostLabel }: ActivityCenterProps) {
  const [open, setOpen] = useState(false);
  const activity = useActivity();
  const pending = countPendingActivities(activity.data?.activities ?? []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={pending === 0 ? "Activity" : `Activity — ${pending} in progress`}
        className={cn(
          "relative inline-flex size-7 items-center justify-center rounded-md",
          "text-text-secondary hover:bg-hover hover:text-foreground",
          FOCUS_RING,
        )}
      >
        <Icon name="activity" aria-hidden className="size-3.75" />
        {pending === 0 ? null : (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-iris-subtle px-1 text-micro font-medium tabular-nums text-iris-text">
            {pending > BADGE_CAP ? `${BADGE_CAP}+` : pending}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-90 p-0">
        <QueryBoundary
          query={activity}
          pending={<p className="px-3 py-4 text-xs text-text-tertiary">Loading activity…</p>}
          error={
            <p className="px-3 py-4 text-xs text-text-tertiary">
              Could not read this host’s activity.
            </p>
          }
        >
          {(snapshot) => (
            <ActivityPanel
              snapshot={snapshot}
              hostLabel={hostLabel}
              onNavigate={() => setOpen(false)}
            />
          )}
        </QueryBoundary>
      </PopoverContent>
    </Popover>
  );
}
