import { useLinearConnection } from "@web/api/linear/queries";
import { LinearConnectionPanel } from "@web/components/settings/integrations/linear-connection-panel";
import { MappedSourcesPanel } from "@web/components/settings/integrations/mapped-sources-panel";
import { SectionHeading } from "@web/components/settings/section-heading";

export function IntegrationsSection() {
  const connection = useLinearConnection();
  const workspaceId =
    connection.isSuccess && connection.data.status === "connected"
      ? connection.data.workspace_id
      : null;

  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Mirror Linear issues into Otomat. The connection is read-only: nothing is written back to Linear."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          <LinearConnectionPanel query={connection} />
        </section>
        <MappedSourcesPanel key={workspaceId ?? ""} workspaceId={workspaceId} />
      </div>
    </div>
  );
}
