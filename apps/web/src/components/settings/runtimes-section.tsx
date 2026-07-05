import { EmptyState } from "@otomat/ui";
import { SectionHeading } from "@web/components/settings/section-heading";

export function RuntimesSection() {
  return (
    <div>
      <SectionHeading
        title="Runtimes"
        description="Adapter catalog with honest capability snapshots (chat, resume, fork, permissions, tool calls, abort)."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon="terminal"
          variant="inline"
          title="No runtimes registered"
          description="Runtime adapters are reported by the daemon. Capabilities are shown as present or absent — never aspirational."
        />
      </div>
    </div>
  );
}
