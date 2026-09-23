import { createFileRoute } from "@tanstack/react-router";
import { prefetchIssue } from "@web/api/route-prefetch";
import { IssueDetailView } from "@web/components/issues/issue/detail-view";
import type { IssueDetailSearch } from "@web/components/issues/issue/search";

export const Route = createFileRoute("/issues/$issueId")({
  validateSearch: (search: Record<string, unknown>): IssueDetailSearch => ({
    run: typeof search.run === "string" ? search.run : undefined,
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  loaderDeps: ({ search }) => ({ run: search.run }),
  loader: ({ params, deps }) => prefetchIssue(params.issueId, deps.run),
  component: IssueDetailView,
});
