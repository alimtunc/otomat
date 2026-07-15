import { ErrorState, Skeleton } from "@otomat/ui";
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
  const shortId = issue.source_external_id ?? issue.id.slice(0, 8);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{issue.title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <span className="font-mono">{shortId}</span>
          <span>·</span>
          <span>{issue.source}</span>
        </div>
      </div>
      {issue.body ? (
        <p className="whitespace-pre-wrap text-sm leading-[1.65] text-foreground">{issue.body}</p>
      ) : null}
    </div>
  );
}
