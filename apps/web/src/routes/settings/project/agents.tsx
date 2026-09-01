import { createFileRoute } from "@tanstack/react-router";
import { ProjectAgentsSection } from "@web/components/settings/project/agents-section";

export const Route = createFileRoute("/settings/project/agents")({
  component: ProjectAgentsSection,
});
