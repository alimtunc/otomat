import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

const COCKPIT_TABS = [
  { value: "conversation", icon: "list-tree", to: "/runs/$runId", label: "Conversation" },
  { value: "report", icon: "list-todo", to: "/runs/$runId/report", label: "Report" },
  { value: "logs", icon: "terminal", to: "/runs/$runId/logs", label: "Logs" },
  { value: "diff", icon: "git-compare", to: "/runs/$runId/diff", label: "Diff" },
  { value: "pr", icon: "git-pull-request", to: "/runs/$runId/pr", label: "PR" },
] as const;

export function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const value = COCKPIT_TABS.find((tab) => matchRoute({ to: tab.to }))?.value ?? "conversation";
  return (
    <SegmentedControl type="single" value={value} aria-label="Run cockpit tabs">
      {COCKPIT_TABS.map((tab) => (
        <SegmentedItem
          key={tab.value}
          value={tab.value}
          icon={<Icon name={tab.icon} className="max-lg:hidden" />}
          nativeButton={false}
          render={<Link to={tab.to} params={{ runId }} />}
        >
          {tab.label}
        </SegmentedItem>
      ))}
    </SegmentedControl>
  );
}
