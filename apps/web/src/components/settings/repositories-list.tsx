import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { useRepositories } from "@web/api/daemon/queries";
import { RepositoryRow } from "@web/components/settings/repository-row";

export function RepositoriesList({ query }: { query: ReturnType<typeof useRepositories> }) {
  if (query.isPending) return <Skeleton className="m-4" height={40} />;

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load repositories"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        icon="folder-git-2"
        variant="inline"
        title="No repositories registered"
        description="Register a local repository to validate its git state and run agents against it."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {query.data.map((repository) => (
        <RepositoryRow key={repository.id} repository={repository} />
      ))}
    </ul>
  );
}
