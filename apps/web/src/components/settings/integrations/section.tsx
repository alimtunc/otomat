import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@otomat/ui";
import { LinearConnectForm } from "@web/components/settings/integrations/linear/connect-form";
import { LinearConnectionsPanel } from "@web/components/settings/integrations/linear/panel";
import { LinearOnboardingPanel } from "@web/components/settings/integrations/onboarding-panel";
import { SectionHeading } from "@web/components/settings/section-heading";
import { useState } from "react";

export function IntegrationsSection() {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Connect Linear workspaces, then choose their teams in each project’s settings."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Linear</h2>
            <Dialog open={adding} onOpenChange={setAdding}>
              <DialogTrigger
                render={
                  <Button variant="primary" size="sm">
                    Add workspace
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Linear workspace</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <LinearConnectForm onConnected={() => setAdding(false)} />
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
          <LinearConnectionsPanel />
          <LinearOnboardingPanel />
        </section>
      </div>
    </div>
  );
}
