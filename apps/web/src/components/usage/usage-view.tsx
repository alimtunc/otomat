import { EmptyState } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import { RouteShell } from "@web/components/shell/route-shell";

export function UsageView() {
  return (
    <RouteShell
      active="usage"
      titleIcon="bar-chart"
      breadcrumbs={[{ label: "Usage", current: true }]}
    >
      <CenteredState>
        <EmptyState
          icon="bar-chart"
          title="No usage data yet"
          description="Cost, tokens and run-time roll-ups appear here once the daemon records runtime usage events."
        />
      </CenteredState>
    </RouteShell>
  );
}
