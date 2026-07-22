import { createFileRoute } from "@tanstack/react-router";
import { AgentProfileDetailView } from "@web/components/agents/agent-profile/detail/view";

export const Route = createFileRoute("/agents/$profileId")({
  component: AgentProfileDetailView,
});
