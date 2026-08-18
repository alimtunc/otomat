import { createFileRoute } from "@tanstack/react-router";
import { PullRequestDiffView } from "@web/components/pull-requests/diff-view";

export const Route = createFileRoute("/pull-requests/$pullRequestId/diff")({
  /** Optional so a link into the reviewer stays valid without naming a file. */
  validateSearch: (search: Record<string, unknown>): { file?: string } => ({
    file: typeof search.file === "string" ? search.file : undefined,
  }),
  component: PullRequestDiffView,
});
