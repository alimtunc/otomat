import { ErrorState, IssueStatusChip, Skeleton } from "@otomat/ui";
import type { useIssue } from "@web/api/issues/queries";

export function IssueHeader({ query }: { query: ReturnType<typeof useIssue> }) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton height={24} width="46%" />
        <Skeleton height={14} width="28%" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load this issue"
        onRetry={() => void query.refetch()}
      />
    );
  }

  const issue = query.data;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IssueStatusChip status={issue.status} />
        <span className="font-mono text-xs text-text-tertiary">{issue.source}</span>
      </div>
      <h1 className="text-lg font-semibold text-foreground">{issue.title}</h1>
      {issue.body ? (
        <p className="whitespace-pre-wrap text-sm text-text-secondary">{issue.body}</p>
      ) : null}
    </div>
  );
}
