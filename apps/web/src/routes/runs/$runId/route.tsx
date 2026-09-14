import { createFileRoute } from "@tanstack/react-router";
import { RunCockpitLayout } from "@web/components/runs/cockpit/layout";
import type { RunConversationSearch } from "@web/components/runs/conversation/search";

export const Route = createFileRoute("/runs/$runId")({
  validateSearch: (search: Record<string, unknown>): RunConversationSearch => ({
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  component: RunCockpitLayout,
});
