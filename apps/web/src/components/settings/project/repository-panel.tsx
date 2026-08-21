import { Chip, EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import { useRepositories } from "@web/api/daemon/queries";
import { InitCommandsForm } from "@web/components/settings/project/init-commands-form";
import { RegisterRepositoryForm } from "@web/components/settings/register-repository-form";
import { QueryList } from "@web/components/shell/query-list";
import { ActiveHostTag } from "@web/components/shell/remote-session/active-host-tag";

export function ProjectRepositoryPanel({ projectId }: { projectId: string }) {
  const repositories = useRepositories(projectId);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Repository</h2>
        <ActiveHostTag />
      </div>
      <QueryList
        query={repositories}
        pending={<Skeleton height={40} />}
        error={
          <ErrorState
            variant="inline"
            title="Couldn’t load this project’s repository"
            onRetry={() => void repositories.refetch()}
          />
        }
        empty={
          <div className="flex flex-col gap-3">
            <EmptyState
              icon="folder-git-2"
              variant="inline"
              title="No repository attached"
              description="Register this project's repository path to launch runs."
            />
            <RegisterRepositoryForm projectId={projectId} />
          </div>
        }
      >
        {(rows) =>
          rows[0] ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-card px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-foreground">{rows[0].name}</span>
                  <span className="truncate font-mono text-xs text-text-tertiary">
                    {rows[0].root_path}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs text-text-tertiary">
                  {rows[0].default_branch}
                </span>
                <Chip tone={rows[0].available ? "success" : "danger"}>
                  {rows[0].available ? "Available" : "Path unavailable"}
                </Chip>
              </div>
              {rows[0].available ? null : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-text-tertiary">
                    The path is gone on that host, or is no longer a git repository. Point the
                    project at its new location there:
                  </p>
                  <RegisterRepositoryForm projectId={projectId} />
                </div>
              )}
              <InitCommandsForm key={rows[0].id} repository={rows[0]} />
            </div>
          ) : null
        }
      </QueryList>
    </section>
  );
}
