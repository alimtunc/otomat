import { ErrorState, Markdown, Skeleton } from "@otomat/ui";
import type { useIssue } from "@web/api/issues/queries";
import { IssueDescription } from "@web/components/issues/issue/description";
import { IssueMetadata } from "@web/components/issues/issue/metadata";
import { LinearIssueHeader } from "@web/components/issues/workspace/linear/header";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import type { ReactNode } from "react";

export function IssueHeader({
  query,
  children,
  hasRun = false,
  comments,
}: {
  query: ReturnType<typeof useIssue>;
  children?: ReactNode;
  hasRun?: boolean;
  comments?: ReactNode;
}) {
  return (
    <QueryBoundary
      query={query}
      pending={<Skeleton height={44} />}
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
              <IssueDescription key={`${issue.id}:${hasRun}`} body={issue.body} collapsed={hasRun}>
                <Markdown value={issue.body} className="text-sm text-foreground" allowMedia />
              </IssueDescription>
            ) : null}
          </div>
        )
      }
    </QueryBoundary>
  );
}
