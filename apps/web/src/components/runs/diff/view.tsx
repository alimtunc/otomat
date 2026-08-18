import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { ReviewDiffView } from "@web/components/runs/diff/review-view";
import { DiffScopeControl } from "@web/components/runs/diff/scope/control";
import { useDiffScope } from "@web/components/runs/diff/scope/use-scope";
import { runPasses, type RunPass } from "@web/lib/run/passes";

const NO_WORKTREE =
  "This run executed without a git worktree, so there is no diff to show. Diffs are never fabricated.";

const NO_PASSES: RunPass[] = [];

export function RunDiffView() {
  const { runId } = useParams({ from: "/runs/$runId/diff" });
  const diffScope = useDiffScope();
  const run = useRunDetail(runId);
  return (
    <ReviewDiffView
      target={{ kind: "run", id: runId }}
      workspace={{
        open: run.data?.holds_workspace === true,
        issueId: run.data?.run.issue_id ?? null,
      }}
      emptyDescription={NO_WORKTREE}
      scope={diffScope.selector}
      scopeControl={(scope) => (
        <DiffScopeControl
          runId={runId}
          scope={scope}
          passes={run.data === undefined ? NO_PASSES : runPasses(run.data)}
          onSelect={diffScope.select}
        />
      )}
    />
  );
}
