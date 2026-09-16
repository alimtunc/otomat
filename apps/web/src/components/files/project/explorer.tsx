import { ErrorState, Icon, IconButton, Spinner } from "@otomat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useRepositoryTree } from "@web/api/repositories/file-queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { branchLabel } from "@web/components/files/branch-label";
import { FilesExplorer } from "@web/components/files/explorer";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export interface ProjectExplorerProps {
  repositoryId: string;
}

export function ProjectExplorer({ repositoryId }: ProjectExplorerProps) {
  const files = useRepositoryTree(repositoryId);
  const keys = useQueryKeys();
  const client = useQueryClient();
  const target = { kind: "repository", id: repositoryId } as const;

  return (
    <QueryBoundary
      query={files}
      pending={
        <CenteredState>
          <Spinner label="Loading repository files" />
        </CenteredState>
      }
      error={
        <ErrorState title="Could not list the repository" onRetry={() => void files.refetch()} />
      }
    >
      {(listing) => (
        <FilesExplorer
          target={target}
          entries={listing.entries}
          editable
          notice={
            <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs">
              <Icon name="folder-git-2" aria-hidden />
              <span className="truncate font-mono">{branchLabel(listing.branch)}</span>
              <span className="ml-auto text-text-tertiary">Current checkout</span>
              <IconButton
                label="Refresh files"
                icon={<Icon name="refresh-cw" aria-hidden />}
                loading={files.isFetching}
                onClick={() => invalidateCheckout(client, keys, target)}
              />
            </div>
          }
        />
      )}
    </QueryBoundary>
  );
}
