import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailView } from "@web/components/issues/issue/detail-view";
import type { IssueDetailSearch } from "@web/components/issues/issue/search";

export const Route = createFileRoute("/issues/$issueId")({
  validateSearch: (search: Record<string, unknown>): IssueDetailSearch => ({
    run: typeof search.run === "string" ? search.run : undefined,
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  component: IssueDetailView,
});
