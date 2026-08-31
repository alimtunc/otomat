import { LinearConnectForm } from "@web/components/settings/integrations/linear/connect-form";
import { LinearConnectionsPanel } from "@web/components/settings/integrations/linear/panel";
import { LinearOnboardingPanel } from "@web/components/settings/integrations/onboarding-panel";
import { SectionHeading } from "@web/components/settings/section-heading";

export function IntegrationsSection() {
  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Connect as many Linear workspaces as you work in, whichever host runs each project. Which connection and which teams feed a project is configured in that project's settings."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          <LinearConnectionsPanel />
          <div className="rounded-lg border border-border-subtle bg-card px-3 py-2.5">
            <LinearConnectForm />
          </div>
          <LinearOnboardingPanel />
        </section>
      </div>
    </div>
  );
}
