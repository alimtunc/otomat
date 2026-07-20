import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsSection } from "@web/components/settings/integrations/section";

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsSection,
});
