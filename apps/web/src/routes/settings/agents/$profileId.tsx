import { createFileRoute } from "@tanstack/react-router";
import { AgentProfileSection } from "@web/components/agents/agent-profile/detail/section";

export const Route = createFileRoute("/settings/agents/$profileId")({
  component: AgentProfileSection,
});
