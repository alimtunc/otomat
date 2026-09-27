import { issueShortId, type IssueContract } from "@otomat/domain";
import { Skeleton } from "@otomat/ui";
import { useLinearRelations } from "@web/api/linear/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { IssueRelationsPanel } from "@web/components/issues/relations/panel";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function LinkedIssueRelations({ issue }: { issue: IssueContract }) {
  const query = useLinearRelations(issue.id);
  return (
    <QueryBoundary
      query={query}
      pending={<Skeleton height={40} />}
      error={
        <ErrorReport
          variant="inline"
          error={query.error}
          context="Couldn’t read issue relations"
          onRetry={() => void query.refetch()}
        />
      }
    >
      {(data) => (
        <IssueRelationsPanel
          data={data}
          identifier={issueShortId(issue)}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      )}
    </QueryBoundary>
  );
}
