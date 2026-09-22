import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useRunFiles } from "@web/api/runs/file-queries";
import { FilesExplorer } from "@web/components/files/explorer";
import { FilesTabs } from "@web/components/files/tabs";
import { FilesWorkspace } from "@web/components/files/workspace";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { SplitSkeleton } from "@web/components/shell/split-skeleton";
import { worktreeFileMessage } from "@web/lib/run/file-refusal";

export function RunFilesView() {
  const { runId } = useParams({ from: "/runs/$runId/files" });
  const files = useRunFiles(runId);
  const target = { kind: "run", id: runId } as const;

  return (
    <FilesWorkspace key={runId} target={target} tabs={<FilesTabs />}>
      <QueryBoundary
        query={files}
        pending={<SplitSkeleton side={264} />}
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
          <FilesExplorer
            target={target}
            entries={listing.entries}
            editable={listing.editable}
            notice={
              listing.editable ? null : (
                <p className="border-b border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-text-secondary">
                  This workspace is archived: its branch tip is shown read-only.
                </p>
              )
            }
          />
        )}
      </QueryBoundary>
    </FilesWorkspace>
  );
}
