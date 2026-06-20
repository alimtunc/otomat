import { EmptyState, SegmentedControl, SegmentedItem } from "@otomat/ui";
import { Link, Outlet, useMatchRoute, useParams } from "@tanstack/react-router";
import { GitCompare, ListTree, Loader } from "lucide-react";

import { RouteShell } from "./shell";

function CockpitTabs({ runId }: { runId: string }) {
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

export function RunCockpitRoute() {
  const { runId } = useParams({ from: "/runs/$runId" });
  return (
    <RouteShell
      active="runs"
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: `Run ${runId}`, current: true },
      ]}
      actions={<CockpitTabs runId={runId} />}
    >
      <Outlet />
    </RouteShell>
  );
}

export function RunTimelineRoute() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={Loader}
        title="Waiting to start"
        description="No event ledger yet. Run timelines stream from a connected daemon (OTO-9)."
      />
    </div>
  );
}

export function RunDiffRoute() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={GitCompare}
        title="No changes yet"
        description="The canonical git diff appears once a run produces changes. Diffs are never fabricated."
      />
    </div>
  );
}
