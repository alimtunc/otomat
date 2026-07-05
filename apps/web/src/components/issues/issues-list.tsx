import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useIssues } from "@web/api/issues/queries";
import { IssueRow } from "@web/components/issues/issue-row";

export function IssuesList({ query }: { query: ReturnType<typeof useIssues> }) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2 p-6">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} height={44} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <ErrorState
          title="Couldn’t load issues"
          description="The daemon is unreachable. Check that it is running, then retry."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (query.data.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon="inbox"
          title="No issues yet"
          description="Start a local run to create your first issue and stream its events live."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {query.data.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}
