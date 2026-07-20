import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

const COCKPIT_TABS = [
  { value: "timeline", icon: "list-tree", to: "/runs/$runId", label: "Timeline" },
  { value: "logs", icon: "terminal", to: "/runs/$runId/logs", label: "Logs" },
  { value: "diff", icon: "git-compare", to: "/runs/$runId/diff", label: "Diff" },
  { value: "pr", icon: "git-pull-request", to: "/runs/$runId/pr", label: "PR" },
] as const;

function activeTab(onLogs: boolean, onDiff: boolean, onPr: boolean): string {
  if (onLogs) return "logs";
  if (onDiff) return "diff";
  if (onPr) return "pr";
  return "timeline";
}

export function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const value = activeTab(
    !!matchRoute({ to: "/runs/$runId/logs" }),
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
          aria-label={tab.label}
          render={<Link to={tab.to} params={{ runId }} />}
        >
          <span className="hidden lg:inline">{tab.label}</span>
        </SegmentedItem>
      ))}
    </SegmentedControl>
  );
}
