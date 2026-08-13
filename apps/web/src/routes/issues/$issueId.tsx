import { createFileRoute } from "@tanstack/react-router";
import { IssueDetailView } from "@web/components/issues/issue/detail-view";

export const Route = createFileRoute("/issues/$issueId")({
  validateSearch: (search: Record<string, unknown>): { run?: string } => ({
    run: typeof search.run === "string" ? search.run : undefined,
  }),
  component: IssueDetailView,
});
