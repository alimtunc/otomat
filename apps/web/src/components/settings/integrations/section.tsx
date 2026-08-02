import { useLinearConnection } from "@web/api/linear/queries";
import { LinearConnectionPanel } from "@web/components/settings/integrations/linear-connection-panel";
import { SectionHeading } from "@web/components/settings/section-heading";

export function IntegrationsSection() {
  const connection = useLinearConnection();

  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Connect Linear once per daemon. Which teams feed which project is configured in that project's settings."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          <LinearConnectionPanel query={connection} />
        </section>
      </div>
    </div>
  );
}
