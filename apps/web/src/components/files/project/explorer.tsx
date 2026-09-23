import { ErrorState, Icon } from "@otomat/ui";
import { useRepositoryTree } from "@web/api/repositories/file-queries";
import { branchLabel } from "@web/components/files/branch-label";
import { FilesExplorer } from "@web/components/files/explorer";
import { FILE_TREE_WIDTH } from "@web/components/files/surface";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { SplitSkeleton } from "@web/components/shell/split-skeleton";

export interface ProjectExplorerProps {
  repositoryId: string;
}

export function ProjectExplorer({ repositoryId }: ProjectExplorerProps) {
  const files = useRepositoryTree(repositoryId);
  const target = { kind: "repository", id: repositoryId } as const;

  return (
    <QueryBoundary
      query={files}
      pending={<SplitSkeleton side={FILE_TREE_WIDTH} />}
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
            </div>
          }
        />
      )}
    </QueryBoundary>
  );
}
