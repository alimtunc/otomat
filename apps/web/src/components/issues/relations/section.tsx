import { Skeleton } from "@otomat/ui";
import { useLinearRelations } from "@web/api/linear/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { CheckedAt } from "@web/components/shell/checked-at";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { IssueRelationsList } from "./list";

export function IssueRelationsSection({
  issueId,
  identifier,
}: {
  issueId: string;
  identifier: string;
}) {
  const query = useLinearRelations(issueId);
  return (
    <RailSection
      title={
        <>
          Relations <span className="ml-auto font-normal normal-case tracking-normal">Linear</span>
        </>
      }
    >
      <QueryBoundary
        query={query}
        pending={<Skeleton height={48} />}
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
          <div className="space-y-3">
            <IssueRelationsList relations={data.relations} identifier={identifier} />
            <CheckedAt
              label="Refresh relations"
              checkedAt={data.checked_at}
              refreshing={query.isFetching}
              onRefresh={() => void query.refetch()}
            />
          </div>
        )}
      </QueryBoundary>
    </RailSection>
  );
}
