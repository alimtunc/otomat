import {
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  Spinner,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCheckout } from "@web/api/files/invalidate";
import { useRepositoryTree } from "@web/api/repositories/file-queries";
import { useSourceControl } from "@web/api/source-control/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { FileBrowser } from "@web/components/files/browser";
import { FilePanel } from "@web/components/files/panel";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export interface ProjectExplorerProps {
  repositoryId: string;
}

export function ProjectExplorer({ repositoryId }: ProjectExplorerProps) {
  const files = useRepositoryTree(repositoryId);
  const changes = useSourceControl({ kind: "repository", id: repositoryId });
  const keys = useQueryKeys();
  const client = useQueryClient();
  const scope = `${keys.host[0]}:repository:${repositoryId}`;
  const active = useFileSelection(scope);
  const layout = usePanelGroupLayout("otomat.project-files");

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
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs">
            <Icon name="folder-git-2" aria-hidden />
            <span className="truncate font-mono">
              {listing.branch === "HEAD" ? "Detached HEAD" : listing.branch}
            </span>
            <span className="ml-auto text-text-tertiary">Current checkout</span>
            <IconButton
              label="Refresh files"
              icon={<Icon name="refresh-cw" aria-hidden />}
              loading={files.isFetching}
              onClick={() =>
                invalidateCheckout(client, keys, { kind: "repository", id: repositoryId })
              }
            />
          </div>
          <QueryBoundary
            query={changes}
            pending={null}
            error={
              <ErrorState
                variant="inline"
                title="Git status unavailable"
                onRetry={() => void changes.refetch()}
              />
            }
          >
            {() => null}
          </QueryBoundary>
          <ResizablePanelGroup {...layout} className="min-h-0 flex-1">
            <SidePanel
              id="project-files"
              label="Project files"
              side="left"
              defaultSize={264}
              minSize={168}
              maxSize="40%"
            >
              <FileBrowser
                key={scope}
                entries={listing.entries}
                changes={changes.data}
                activePath={active.path}
                onSelect={active.select}
                scope={scope}
              />
            </SidePanel>
            <ResizablePanel id="project-file" minSize="40%">
              {active.path === null ? (
                <CenteredState>
                  <EmptyState
                    icon="file-text"
                    title="No file open"
                    description="Choose a file, or press ⌘P / Ctrl+P to find it."
                  />
                </CenteredState>
              ) : (
                <FilePanel
                  target={{ kind: "repository", id: repositoryId }}
                  path={active.path}
                  editable
                />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </QueryBoundary>
  );
}
