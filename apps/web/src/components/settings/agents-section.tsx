import { EmptyState } from "@otomat/ui";
import { SectionHeading } from "@web/components/settings/section-heading";

export function AgentsSection() {
  return (
    <div>
      <SectionHeading
        title="Agents"
        description="Agent catalog: name, purpose, default runtime preference, allowed capabilities."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon="bot"
          variant="inline"
          title="No agents configured"
          description="Agents are defined alongside the daemon. None are configured yet."
        />
      </div>
    </div>
  );
}
