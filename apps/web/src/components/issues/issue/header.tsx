import { ErrorState, Markdown, Skeleton } from "@otomat/ui";
import type { useIssue } from "@web/api/issues/queries";
import { IssueDescription } from "@web/components/issues/issue/description";
import { IssueMetadata } from "@web/components/issues/issue/metadata";
import { LinearIssueHeader } from "@web/components/issues/workspace/linear/header";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import type { ReactNode } from "react";

const HEADER_PENDING = (
  <div className="flex flex-col gap-2.5">
    <Skeleton className="h-7 w-2/3" />
    <Skeleton className="h-3.5 w-56" />
  </div>
);

function LocalIssueDescription({
  issueId,
  body,
  hasRun,
}: {
  issueId: string;
  body: string;
  hasRun: boolean | null;
}) {
  if (hasRun === null) return <Skeleton height={64} />;
  return (
    <IssueDescription key={`${issueId}:${hasRun}`} body={body} collapsed={hasRun}>
      <Markdown value={body} className="text-sm text-foreground" allowMedia />
    </IssueDescription>
  );
}

export function IssueHeader({
  query,
  children,
  hasRun,
  comments,
}: {
  query: ReturnType<typeof useIssue>;
  children?: ReactNode;
  /** Null while the issue's runs are unknown: the description's collapsed default depends on them. */
  hasRun: boolean | null;
  comments?: ReactNode;
}) {
  return (
    <QueryBoundary
      query={query}
      pending={HEADER_PENDING}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load this issue"
          onRetry={() => void query.refetch()}
        />
      }
    >
      {(issue) =>
        issue.source === "linear" ? (
          <LinearIssueHeader issue={issue} hasRun={hasRun} comments={comments}>
            {children}
          </LinearIssueHeader>
        ) : (
          <div className="flex shrink-0 flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                {issue.title}
              </h1>
              <IssueMetadata issue={issue} />
            </div>
            {children}
            {issue.body ? (
              <LocalIssueDescription issueId={issue.id} body={issue.body} hasRun={hasRun} />
            ) : null}
          </div>
        )
      }
    </QueryBoundary>
  );
}
