import { PlaceholderView } from "@web/components/shell/placeholder-view";

export function UsageView() {
  return (
    <PlaceholderView
      active="usage"
      icon="bar-chart"
      label="Usage"
      title="No usage data yet"
      description="Cost, tokens and run-time roll-ups appear here once the daemon records runtime usage events."
    />
  );
}
