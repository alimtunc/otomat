import { createFileRoute } from "@tanstack/react-router";
import { RunConversationView } from "@web/components/runs/conversation/view";

export const Route = createFileRoute("/runs/$runId/")({
  component: RunConversationView,
});
