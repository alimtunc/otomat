import { createFileRoute } from "@tanstack/react-router";
import type { RunConversationSearch } from "@web/components/runs/conversation/search";
import { RunConversationView } from "@web/components/runs/conversation/view";

export const Route = createFileRoute("/runs/$runId/")({
  validateSearch: (search: Record<string, unknown>): RunConversationSearch => ({
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  component: RunConversationView,
});
