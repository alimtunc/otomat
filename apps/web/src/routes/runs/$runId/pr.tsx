import type { PullRequestPublicationMode } from "@otomat/domain";
import { createFileRoute } from "@tanstack/react-router";
import { isPullRequestPublicationMode } from "@web/components/runs/pr/model";
import { RunPrView } from "@web/components/runs/pr/view";

/** `customize` reveals the advanced fields; `mode` carries the operator's explicit Draft/Ready choice, so both survive a reload. */
export const Route = createFileRoute("/runs/$runId/pr")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { customize?: true; mode?: PullRequestPublicationMode } => ({
    customize: search.customize === true ? true : undefined,
    mode:
      typeof search.mode === "string" && isPullRequestPublicationMode(search.mode)
        ? search.mode
        : undefined,
  }),
  component: RunPrView,
});
