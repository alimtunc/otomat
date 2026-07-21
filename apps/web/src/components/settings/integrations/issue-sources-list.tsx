import type { IssueSourceContract, ProjectContract } from "@otomat/domain";
import { EmptyState, ErrorState, RelativeTime, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { QueryList } from "@web/components/shell/query-list";

interface IssueSourcesListProps {
  query: UseQueryResult<IssueSourceContract[]>;
  projects: ProjectContract[];
}

export function IssueSourcesList({ query, projects }: IssueSourcesListProps) {
  return (
    <QueryList
      query={query}
      pending={<Skeleton className="m-3 h-10" />}
      error={<ErrorState variant="inline" title="Could not load mapped sources." />}
      empty={
        <EmptyState
          icon="plug"
          variant="inline"
          title="No mapped sources"
          description="Map a Linear team to a local project to start importing its issues."
        />
      }
    >
      {(sources) => (
        <ul className="divide-y divide-border-subtle">
          {sources.map((source) => (
            <li key={source.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {source.external_team_key}
                  {source.external_project_name === "" ? "" : ` · ${source.external_project_name}`}
                </p>
                <p className="truncate text-xs text-text-tertiary">
                  {projects.find((project) => project.id === source.project_id)?.name ??
                    source.project_id}
                </p>
              </div>
              <span className="flex-none text-xs text-text-tertiary">
                {source.last_synced_at === null ? (
                  "Never synced"
                ) : (
                  <RelativeTime date={source.last_synced_at} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </QueryList>
  );
}
