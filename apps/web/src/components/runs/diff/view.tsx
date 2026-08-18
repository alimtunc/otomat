import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { ReviewDiffView } from "@web/components/runs/diff/review-view";

const NO_WORKTREE =
  "This run executed without a git worktree, so there is no diff to show. Diffs are never fabricated.";

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const run = useRunDetail(runId);
  return (
    <ReviewDiffView
      target={{ kind: "run", id: runId }}
      workspace={{
        open: run.data?.holds_workspace === true,
        issueId: run.data?.run.issue_id ?? null,
      }}
      emptyDescription={NO_WORKTREE}
    />
  );
}
