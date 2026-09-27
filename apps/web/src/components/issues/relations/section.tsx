import { Icon, IconButton, RelativeTime, Skeleton } from "@otomat/ui";
import { useLinearRelations } from "@web/api/linear/use-relations";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { RailSection } from "@web/components/issues/workspace/rail/rail-primitives";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { IssueNeighbor } from "./neighbor";

const GROUPS = [
  { type: "blocked_by", label: "Blocked by" },
  { type: "blocks", label: "Blocks" },
  { type: "related", label: "Related" },
] as const;

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
          <div className="@container space-y-3">
            {GROUPS.map((group) => {
              const relations = data.relations.filter((relation) => relation.type === group.type);
              return relations.length === 0 ? null : (
                <div key={group.type}>
                  <h3 className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    {group.type === "related" ? null : (
                      <Icon
                        name="flag"
                        size="xs"
                        className={group.type === "blocked_by" ? "text-warning" : "text-danger"}
                      />
                    )}
                    {group.label}
                    <span className="font-normal tabular-nums text-text-tertiary">
                      {relations.length}
                    </span>
                  </h3>
                  <div className="mt-2 space-y-2">
                    {relations.map((relation) => (
                      <div
                        key={relation.id}
                        className="rounded-md border border-border bg-surface-1"
                      >
                        <IssueNeighbor
                          issue={relation.issue}
                          relation={{ type: relation.type, identifier }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {data.relations.length === 0 ? (
              <p className="text-xs text-text-tertiary">No blocking or related issues.</p>
            ) : null}
            <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
              <span className="text-xs text-text-tertiary">
                Checked <RelativeTime date={data.checked_at} />
              </span>
              <IconButton
                size="sm"
                label="Refresh relations"
                icon={<Icon name="refresh-cw" size="xs" />}
                loading={query.isFetching}
                onClick={() => void query.refetch()}
              />
            </div>
          </div>
        )}
      </QueryBoundary>
    </RailSection>
  );
}
