import { ErrorState, IssueSourceGlyph, Skeleton } from "@otomat/ui";
import type { useIssue } from "@web/api/issues/queries";
import { LinearIssueHeader } from "@web/components/issues/workspace/linear/linear-issue-header";
import { issueShortId } from "@web/lib/ids";

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
  if (issue.source === "linear") return <LinearIssueHeader issue={issue} />;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{issue.title}</h1>
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <IssueSourceGlyph source={issue.source} />
          <span className="font-mono">{issueShortId(issue)}</span>
        </div>
      </div>
      {issue.body ? (
        <p className="whitespace-pre-wrap text-sm leading-[1.65] text-foreground">{issue.body}</p>
      ) : null}
    </div>
  );
}
