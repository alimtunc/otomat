import { createFileRoute } from "@tanstack/react-router";
import { AgentsSection } from "@web/components/settings/agents-section";

export const Route = createFileRoute("/settings/agents")({
  component: AgentsSection,
});
