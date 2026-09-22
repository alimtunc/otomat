import { createFileRoute } from "@tanstack/react-router";
import { prefetchRun } from "@web/api/route-prefetch";
import type { ConversationsSearch } from "@web/components/conversations/search";
import { ConversationsView } from "@web/components/conversations/view";

export const Route = createFileRoute("/conversations")({
  // A step is only addressable through its run: a bare `step` cannot open a thread.
  validateSearch: (search: Record<string, unknown>): ConversationsSearch => {
    const run = typeof search.run === "string" ? search.run : undefined;
    return {
      run,
      step: run !== undefined && typeof search.step === "string" ? search.step : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: ({ deps }) => {
    if (deps.run !== undefined) prefetchRun(deps.run);
  },
  component: ConversationsView,
});
