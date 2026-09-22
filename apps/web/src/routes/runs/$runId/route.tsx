import { createFileRoute } from "@tanstack/react-router";
import { prefetchRun } from "@web/api/route-prefetch";
import { RunCockpitLayout } from "@web/components/runs/cockpit/layout";
import type { RunConversationSearch } from "@web/components/runs/conversation/search";

export const Route = createFileRoute("/runs/$runId")({
  validateSearch: (search: Record<string, unknown>): RunConversationSearch => ({
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  loader: ({ params }) => prefetchRun(params.runId),
  component: RunCockpitLayout,
});
