import { SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { GitCompare, GitPullRequest, ListTree } from "lucide-react";

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
      <SegmentedItem
        value="timeline"
        icon={<ListTree />}
        render={<Link to="/runs/$runId" params={{ runId }} />}
      >
        Timeline
      </SegmentedItem>
      <SegmentedItem
        value="diff"
        icon={<GitCompare />}
        render={<Link to="/runs/$runId/diff" params={{ runId }} />}
      >
        Diff
      </SegmentedItem>
      <SegmentedItem
        value="pr"
        icon={<GitPullRequest />}
        render={<Link to="/runs/$runId/pr" params={{ runId }} />}
      >
        PR
      </SegmentedItem>
    </SegmentedControl>
  );
}
