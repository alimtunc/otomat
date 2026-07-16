import { Button, EmptyState, Icon } from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import { RouteShell } from "@web/components/shell/route-shell";

export function SkillsView() {
  return (
    <RouteShell
      active="skills"
      titleIcon="book"
      titleNote="Instructions any agent in this workspace can use."
      breadcrumbs={[{ label: "Skills", current: true }]}
      actions={
        <Button variant="primary" size="sm" disabled title="Skills are not wired up yet">
          <Icon name="plus" aria-hidden />
          New skill
        </Button>
      }
    >
      <CenteredState>
        <EmptyState
          icon="book"
          title="No skills yet"
          description="Reusable instructions shared across agents land here once the daemon stores them."
        />
      </CenteredState>
    </RouteShell>
  );
}
