import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

const COCKPIT_TABS = [
  { value: "timeline", icon: "list-tree", to: "/runs/$runId", label: "Timeline" },
  { value: "report", icon: "list-todo", to: "/runs/$runId/report", label: "Report" },
  { value: "logs", icon: "terminal", to: "/runs/$runId/logs", label: "Logs" },
  { value: "diff", icon: "git-compare", to: "/runs/$runId/diff", label: "Diff" },
  { value: "pr", icon: "git-pull-request", to: "/runs/$runId/pr", label: "PR" },
] as const;

export function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const value = COCKPIT_TABS.find((tab) => matchRoute({ to: tab.to }))?.value ?? "timeline";
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
