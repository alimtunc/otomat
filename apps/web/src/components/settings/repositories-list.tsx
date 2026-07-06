import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useRepositories } from "@web/api/daemon/queries";
import { RepositoryRow } from "@web/components/settings/repository-row";
import { QueryList } from "@web/components/shell/query-list";

export function RepositoriesList({ query }: { query: ReturnType<typeof useRepositories> }) {
  return (
    <QueryList
      query={query}
      pending={<Skeleton className="m-4" height={40} />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load repositories"
          onRetry={() => void query.refetch()}
        />
      }
      empty={
        <EmptyState
          icon="folder-git-2"
          variant="inline"
          title="No repositories registered"
          description="Register a local repository to validate its git state and run agents against it."
        />
      }
    >
      {(repositories) => (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {repositories.map((repository) => (
            <RepositoryRow key={repository.id} repository={repository} />
          ))}
        </ul>
      )}
    </QueryList>
  );
}
