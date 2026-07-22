import { createFileRoute } from "@tanstack/react-router";
import { AgentsView } from "@web/components/agents/agent-profile/list/view";

export const Route = createFileRoute("/agents/")({
  component: AgentsView,
});
