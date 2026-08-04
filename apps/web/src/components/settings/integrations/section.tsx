import { useLinearConnection } from "@web/api/linear/queries";
import { LinearConnectionPanel } from "@web/components/settings/integrations/linear-connection-panel";
import { SectionHeading } from "@web/components/settings/section-heading";
import { remoteHostAlias } from "@web/lib/desktop-bridge";

export function IntegrationsSection() {
  const connection = useLinearConnection();
  const remoteAlias = remoteHostAlias();

  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Connect Linear once for the local daemon. Which teams feed which project is configured in that project's settings."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          {remoteAlias === null ? (
            <LinearConnectionPanel query={connection} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Linear connects on the local daemon only. Switch to a local project to manage it.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
