import { Button, EmptyState } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { CenteredState } from "@web/components/shell/centered-state";

export function AgentProfileNotFoundState() {
  return (
    <CenteredState>
      <EmptyState
        icon="bot"
        title="Agent profile not found"
        description="It may have been deleted or duplicated under a different identifier."
        action={
          <Button variant="outline" size="sm" render={<Link to="/agents" />}>
            Back to agents
          </Button>
        }
      />
    </CenteredState>
  );
}
