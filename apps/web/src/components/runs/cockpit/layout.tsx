import { Outlet, useParams } from "@tanstack/react-router";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { CockpitTabs } from "@web/components/runs/cockpit/tabs";
import { RouteShell } from "@web/components/shell/route-shell";

export function RunCockpitLayout() {
  const { runId } = useParams({ from: "/runs/$runId" });
  return (
    <RunEventsProvider runId={runId}>
      <RouteShell
        active="issues"
        breadcrumbs={[
          { label: "Issues", href: "/issues" },
          { label: `Run ${runId.slice(0, 8)}`, current: true },
        ]}
        actions={<CockpitTabs runId={runId} />}
      >
        <Outlet />
      </RouteShell>
    </RunEventsProvider>
  );
}
