import type { IssueSourceContract, LinearTeamContract, ProjectContract } from "@otomat/domain";
import { Button, EmptyState, ErrorState, RelativeTime, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useDeleteIssueSource } from "@web/api/linear/mutations";
import { SourceLifecycleFields } from "@web/components/settings/integrations/source-lifecycle";
import { QueryList } from "@web/components/shell/query-list";

interface IssueSourcesListProps {
  query: UseQueryResult<IssueSourceContract[]>;
  projects: ProjectContract[];
  teams: LinearTeamContract[];
  /** Shows an Unmap action per row; issues already imported stay, they just stop syncing. */
  removable?: boolean;
}

export function IssueSourcesList({
  query,
  projects,
  teams,
  removable = false,
}: IssueSourcesListProps) {
  const remove = useDeleteIssueSource();
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
            <li key={source.id} className="flex flex-col gap-2.5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {source.external_team_key}
                    {source.external_project_name === ""
                      ? ""
                      : ` · ${source.external_project_name}`}
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
                {removable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    loading={remove.isPending && remove.variables === source.id}
                    onClick={() => remove.mutate(source.id)}
                  >
                    Unmap
                  </Button>
                ) : null}
              </div>
              <SourceLifecycleFields
                source={source}
                states={teams.find((team) => team.id === source.external_team_id)?.states ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </QueryList>
  );
}
