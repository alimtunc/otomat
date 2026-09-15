import {
  EmptyState,
  ErrorState,
  ResizablePanel,
  ResizablePanelGroup,
  SidePanel,
  usePanelGroupLayout,
} from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunFiles } from "@web/api/runs/file-queries";
import { useSourceControl } from "@web/api/source-control/queries";
import { FileBrowser } from "@web/components/files/browser";
import { FilePanel } from "@web/components/files/panel";
import { useFileSelection } from "@web/components/files/use-file-selection";
import { FilesWorkspace } from "@web/components/files/workspace";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useActiveHostId } from "@web/lib/active-host";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export function RunFilesView() {
  const { runId } = useParams({ from: "/runs/$runId/files" });
  const files = useRunFiles(runId);
  const changes = useSourceControl({ kind: "run", id: runId }, files.data?.editable === true);
  const host = useActiveHostId();
  const scope = `${host}:run:${runId}`;
  const active = useFileSelection(scope);
  const layout = usePanelGroupLayout("otomat.run-files");

  return (
    <FilesWorkspace key={scope} target={{ kind: "run", id: runId }}>
      <div className="flex h-full min-h-0 flex-col">
        <QueryBoundary
          query={files}
          pending={<DetailSkeleton blocks={2} />}
          error={
            <CenteredState>
              <ErrorState
                title="Could not list the worktree"
                description={worktreeFileMessage(
                  files.error,
                  "The daemon did not answer or git could not read the worktree.",
                )}
                onRetry={() => void files.refetch()}
              />
            </CenteredState>
          }
        >
          {(listing) => (
            <>
              {listing.editable ? null : (
                <p className="border-b border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-text-secondary">
                  This workspace is archived: its branch tip is shown read-only.
                </p>
              )}
              {listing.editable ? (
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
              ) : null}
              <ResizablePanelGroup {...layout} className="min-h-0 flex-1">
                <SidePanel
                  id="run-files"
                  label="Worktree files"
                  side="left"
                  defaultSize={264}
                  minSize={168}
                  maxSize="40%"
                >
                  <FileBrowser
                    key={scope}
                    scope={scope}
                    entries={listing.entries}
                    changes={changes.data}
                    activePath={active.path}
                    onSelect={active.select}
                  />
                </SidePanel>
                <ResizablePanel id="file" minSize="40%">
                  {active.path === null ? (
                    <CenteredState>
                      <EmptyState
                        icon="file-text"
                        title="No file open"
                        description="Pick a file in the tree to read it, or edit it in place when the worktree is live."
                      />
                    </CenteredState>
                  ) : (
                    <FilePanel
                      target={{ kind: "run", id: runId }}
                      path={active.path}
                      editable={listing.editable}
                    />
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </>
          )}
        </QueryBoundary>
      </div>
    </FilesWorkspace>
  );
}
