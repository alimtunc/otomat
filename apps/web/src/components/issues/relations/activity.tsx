import { IssueStatusChip, RunStatusChip, Skeleton } from "@otomat/ui";
import { useQuery } from "@tanstack/react-query";
import { issueOptions } from "@web/api/issues/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function IssueNeighborActivity({ issueId }: { issueId: string }) {
  const keys = useQueryKeys();
  const query = useQuery({ ...issueOptions(keys, issueId), refetchInterval: 10_000 });
  return (
    <QueryBoundary
      query={query}
      pending={
        <span className="block px-2 pb-2">
          <Skeleton width={80} height={12} />
        </span>
      }
      error={<p className="px-2 pb-2 text-xs text-text-tertiary">Activity unavailable</p>}
    >
      {(issue) => {
        if (issue.workspace.state === "closed" && issue.status !== "blocked") return null;
        return (
          <span className="flex items-center gap-1.5 px-2 pb-2 text-xs text-text-tertiary">
            {issue.workspace.state === "open" ? (
              <>
                Run <RunStatusChip status={issue.workspace.run_status} />
              </>
            ) : (
              <>
                Otomat <IssueStatusChip status="blocked" />
              </>
            )}
          </span>
        );
      }}
    </QueryBoundary>
  );
}
