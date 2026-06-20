import { SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { GitCompare, ListTree } from "lucide-react";

export function CockpitTabs({ runId }: { runId: string }) {
  const matchRoute = useMatchRoute();
  const onDiff = !!matchRoute({ to: "/runs/$runId/diff" });
  const value = onDiff ? "diff" : "timeline";
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
    </SegmentedControl>
  );
}
