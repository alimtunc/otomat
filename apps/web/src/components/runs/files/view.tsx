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
import { useActiveDiffFile } from "@web/components/runs/diff/use-active-file";
import { WorktreeFileBrowser } from "@web/components/runs/files/browser";
import { WorktreeFilePanel } from "@web/components/runs/files/panel";
import { CenteredState } from "@web/components/shell/centered-state";
import { DetailSkeleton } from "@web/components/shell/detail-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export function RunFilesView() {
  const { runId } = useParams({ from: "/runs/$runId/files" });
  const files = useRunFiles(runId);
  const active = useActiveDiffFile();
  const layout = usePanelGroupLayout("otomat.run-files");

  return (
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
            <ResizablePanelGroup {...layout} className="min-h-0 flex-1">
              <SidePanel
                id="run-files"
                label="Worktree files"
                side="left"
                defaultSize={264}
                minSize={168}
                maxSize="40%"
              >
                <WorktreeFileBrowser
                  entries={listing.entries}
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
                  <WorktreeFilePanel runId={runId} path={active.path} editable={listing.editable} />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
