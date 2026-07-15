import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

const COCKPIT_TABS = [
  { value: "timeline", icon: "list-tree", to: "/runs/$runId", label: "Timeline" },
  { value: "diff", icon: "git-compare", to: "/runs/$runId/diff", label: "Diff" },
  { value: "pr", icon: "git-pull-request", to: "/runs/$runId/pr", label: "PR" },
] as const;

function activeTab(onDiff: boolean, onPr: boolean): string {
  if (onDiff) return "diff";
  if (onPr) return "pr";
  return "timeline";
}

export function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const value = activeTab(
    !!matchRoute({ to: "/runs/$runId/diff" }),
    !!matchRoute({ to: "/runs/$runId/pr" }),
  );
  return (
    <SegmentedControl type="single" value={value} aria-label="Run cockpit tabs">
      {COCKPIT_TABS.map((tab) => (
        <SegmentedItem
          key={tab.value}
          value={tab.value}
          icon={<Icon name={tab.icon} />}
          nativeButton={false}
          render={<Link to={tab.to} params={{ runId }} />}
        >
          {tab.label}
        </SegmentedItem>
      ))}
    </SegmentedControl>
  );
}
