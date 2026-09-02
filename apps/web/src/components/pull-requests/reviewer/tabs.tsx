import { Icon, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";

const REVIEWER_TABS = [
  {
    value: "overview",
    icon: "list-todo",
    to: "/pull-requests/$pullRequestId/overview",
    label: "Overview",
  },
  {
    value: "diff",
    icon: "git-compare",
    to: "/pull-requests/$pullRequestId/diff",
    label: "Diff",
  },
] as const;

export function PullRequestReviewerTabs({ pullRequestId }: { pullRequestId: string }) {
  const matchRoute = useMatchRoute();
  const value = REVIEWER_TABS.find((tab) => matchRoute({ to: tab.to }))?.value ?? "overview";
  return (
    <SegmentedControl type="single" value={value} aria-label="Pull request reviewer tabs">
      {REVIEWER_TABS.map((tab) => (
        <SegmentedItem
          key={tab.value}
          value={tab.value}
          icon={<Icon name={tab.icon} className="max-lg:hidden" />}
          nativeButton={false}
          render={<Link to={tab.to} params={{ pullRequestId }} />}
        >
          {tab.label}
        </SegmentedItem>
      ))}
    </SegmentedControl>
  );
}
