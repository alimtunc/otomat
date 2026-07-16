import { createFileRoute } from "@tanstack/react-router";
import { AgentsView } from "@web/components/agents/agents-view";

export const Route = createFileRoute("/agents")({
  component: AgentsView,
});
