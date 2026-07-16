import { Button, EmptyState, Icon } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import { RouteShell } from "@web/components/shell/route-shell";

export function AgentsView() {
  return (
    <RouteShell
      active="agents"
      titleIcon="bot"
      titleNote="AI teammates that pick up runs from issues."
      breadcrumbs={[{ label: "Agents", current: true }]}
      actions={
        <Button variant="primary" size="sm" disabled title="Agent catalog is not wired up yet">
          <Icon name="plus" aria-hidden />
          New agent
        </Button>
      }
    >
      <CenteredState>
        <EmptyState
          icon="bot"
          title="Agent catalog"
          description="Name, purpose, default runtime preference, prompt profile, allowed capabilities. The daemon does not expose an agent registry yet — runtime adapters live in Settings → Runtimes."
        />
      </CenteredState>
    </RouteShell>
  );
}
