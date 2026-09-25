import { ErrorState, Skeleton } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunDetail } from "@web/api/runs/queries";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { TerminalWorkspace } from "./workspace";

export function RunTerminalView() {
  const { runId } = useParams({ from: "/runs/$runId/terminal" });
  const query = useRunDetail(runId);
  return (
    <QueryBoundary
      query={query}
      pending={<Skeleton height={320} />}
      error={<ErrorState title="Could not load run" onRetry={() => void query.refetch()} />}
    >
      {(detail) =>
        detail.holds_workspace ? (
          <div className="h-full min-h-80 p-3 sm:p-4">
            <TerminalWorkspace issueId={detail.run.issue_id} runId={runId} />
          </div>
        ) : (
          <p className="p-4 text-sm text-text-secondary">
            This run no longer owns the issue workspace. Open Terminal from the issue to work on its
            current workspace.
          </p>
        )
      }
    </QueryBoundary>
  );
}
