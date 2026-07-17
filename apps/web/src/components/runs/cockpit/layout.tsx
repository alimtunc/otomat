import { RunStatusChip } from "@otomat/ui";
import { Outlet, useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { RunEventsProvider } from "@web/api/runs/run-events-provider";
import { CockpitTabs } from "@web/components/runs/cockpit/tabs";
import { RouteShell } from "@web/components/shell/route-shell";
import { shortId } from "@web/lib/ids";

export function RunCockpitLayout() {
  const { runId } = useParams({ from: "/runs/$runId" });
  const detail = useRunDetail(runId);
  return (
    <RunEventsProvider runId={runId}>
      <RouteShell
        active="runs"
        breadcrumbs={[
          { label: "Runs", href: "/runs" },
          { label: `Run ${shortId(runId)}`, current: true },
        ]}
        breadcrumbExtra={detail.data ? <RunStatusChip status={detail.data.run.status} /> : null}
        actions={<CockpitTabs runId={runId} />}
      >
        <Outlet />
      </RouteShell>
    </RunEventsProvider>
  );
}
