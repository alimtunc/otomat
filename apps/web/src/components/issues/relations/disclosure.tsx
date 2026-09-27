import { Button, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { useLinearRelations } from "@web/api/linear/use-relations";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { IssueLinksPanel } from "./panel";

export function IssueRelationsDisclosure({
  issueId,
  identifier,
}: {
  issueId: string;
  identifier: string;
}) {
  const query = useLinearRelations(issueId);
  return (
    <QueryBoundary
      query={query}
      pending={<p className="text-xs text-text-tertiary">Loading relations…</p>}
      error={
        <ErrorReport
          variant="inline"
          error={query.error}
          context="Relations unavailable"
          onRetry={() => void query.refetch()}
        />
      }
    >
      {(data) => {
        const neighbors = [
          ...(data.parent === null ? [] : [data.parent]),
          ...data.children,
          ...data.relations.map((relation) => relation.issue),
        ];
        const count = new Set(neighbors.map((neighbor) => neighbor.external_id)).size;
        const blockers = data.relations.filter((relation) => relation.type === "blocked_by").length;
        if (count === 0) return <p className="text-xs text-text-tertiary">No linked issues</p>;
        return (
          <Collapsible className="group/relations">
            <CollapsibleTrigger
              render={
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-1" />
              }
            >
              <Icon name="list-tree" size="sm" className="text-text-tertiary" />
              <span>
                {count} linked {count === 1 ? "issue" : "issues"}
              </span>
              {blockers === 0 ? null : (
                <span className="ml-auto flex items-center gap-1 text-xs text-warning">
                  <Icon name="flag" size="xs" />
                  Blocked by {blockers}
                </span>
              )}
              <Icon
                name="chevron-down"
                size="xs"
                className="ml-auto text-text-tertiary group-data-[closed]/relations:-rotate-90"
              />
            </CollapsibleTrigger>
            <CollapsiblePanel className="pt-3">
              <IssueLinksPanel issueId={issueId} identifier={identifier} />
            </CollapsiblePanel>
          </Collapsible>
        );
      }}
    </QueryBoundary>
  );
}
