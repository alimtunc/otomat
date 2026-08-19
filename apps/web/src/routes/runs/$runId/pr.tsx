import { createFileRoute } from "@tanstack/react-router";
import { isPullRequestPublicationMode, type PrSearch } from "@web/components/runs/pr/model";
import { RunPrView } from "@web/components/runs/pr/view";

export const Route = createFileRoute("/runs/$runId/pr")({
  validateSearch: (search: Record<string, unknown>): PrSearch => ({
    customize: search.customize === true ? true : undefined,
    mode:
      typeof search.mode === "string" && isPullRequestPublicationMode(search.mode)
        ? search.mode
        : undefined,
  }),
  component: RunPrView,
});
