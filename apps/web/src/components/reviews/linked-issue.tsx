import { issueShortId, type PullRequestInboxEntry } from "@otomat/domain";
import { FOCUS_RING, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { IssueLinksPanel } from "@web/components/issues/relations/panel";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function ReviewLinkedIssue({
  issue,
}: {
  issue: NonNullable<PullRequestInboxEntry["issue"]>;
}) {
  const query = useIssue(issue.id);
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-surface-1 p-2.5">
        <p className="mb-1 text-xs text-text-tertiary">
          {issue.evidence === "attachment" ? "Attached issue" : "Referenced issue · not attached"}
        </p>
        <Link
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className={`block rounded text-sm text-foreground hover:underline ${FOCUS_RING}`}
        >
          <span className="mb-1 block font-mono text-xs text-text-secondary">
            {issue.identifier}
          </span>
          {issue.title}
        </Link>
      </div>
      <QueryBoundary
        query={query}
        pending={<Skeleton height={40} />}
        error={
          <ErrorReport
            variant="inline"
            error={query.error}
            context="Couldn’t read linked issue"
            onRetry={() => void query.refetch()}
          />
        }
      >
        {(data) =>
          data.source === "linear" ? (
            <IssueLinksPanel issueId={data.id} identifier={issueShortId(data)} />
          ) : null
        }
      </QueryBoundary>
    </div>
  );
}
