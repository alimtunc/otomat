import { useLinearConnection } from "@web/api/linear/queries";
import { HostDeliveryPanel } from "@web/components/settings/integrations/host-delivery-panel";
import { LinearConnectionPanel } from "@web/components/settings/integrations/linear-connection-panel";
import { LinearOnboardingPanel } from "@web/components/settings/integrations/onboarding-panel";
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
        description="Connect Linear once for the whole app, whichever host the active project runs on. Which teams feed which project is configured in that project's settings."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          <LinearConnectionPanel query={connection} />
          {workspaceId === null ? null : <LinearOnboardingPanel workspaceId={workspaceId} />}
          <HostDeliveryPanel />
        </section>
      </div>
    </div>
  );
}
