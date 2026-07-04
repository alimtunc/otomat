import { Outlet, useParams } from "@tanstack/react-router";
import { CockpitTabs } from "@web/components/runs/cockpit-tabs";
import { RouteShell } from "@web/components/shell/route-shell";

export function RunCockpitLayout() {
  const { runId } = useParams({ from: "/runs/$runId" });
  return (
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
  );
}
