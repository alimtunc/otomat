import { useLinearRelations } from "@web/api/linear/use-relations";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { IssueNeighbor } from "./neighbor";

export function IssueParent({ issueId }: { issueId: string }) {
  const query = useLinearRelations(issueId);
  if (query.data === undefined || query.data.parent === null) return null;
  return (
    <QueryBoundary query={query} pending={null} error={null}>
      {(data) =>
        data.parent === null ? null : (
          <nav aria-label="Parent issue" className="@container -ml-2">
            <span className="px-2 text-xs text-text-tertiary">Sub-issue of</span>
            <IssueNeighbor issue={data.parent} />
          </nav>
        )
      }
    </QueryBoundary>
  );
}
