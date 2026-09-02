import { isWorkspaceCleanable, type ExecutionHostId, type WorkspaceEntry } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Skeleton,
} from "@otomat/ui";
import { useRunWorkspace } from "@web/api/runs/queries";
import { cleanupWorkspaceErrorMessage, useCleanupWorkspace } from "@web/api/workspaces/mutations";
import { WorkspaceClosureEvidence } from "@web/components/runs/actions/workspace-closure-evidence";
import { useActiveHostId } from "@web/lib/active-host";
import { workspaceBlockerAction } from "@web/lib/workspace/blocker";

export interface CleanWorkspaceDialogProps {
  entry: WorkspaceEntry;
  hostId: ExecutionHostId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CleanWorkspaceDialog({
  entry,
  hostId,
  open,
  onOpenChange,
}: CleanWorkspaceDialogProps) {
  const activeHostId = useActiveHostId();
  const owned = hostId === activeHostId;
  const summary = useRunWorkspace(entry.run_id ?? "", open && entry.run_id !== null && owned);
  const cleanup = useCleanupWorkspace();
  const blocked = !isWorkspaceCleanable(entry);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Clean this workspace">
        <DialogHeader>
          <DialogTitle>Clean workspace</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            This deletes the worktree at <span className="font-mono">{entry.path}</span> and its
            local branch. The merged pull request and its commits stay on GitHub.
          </p>
          {owned ? null : (
            <p className="m-0 text-sm text-text-tertiary">
              This worktree lives on another host. Its commits and pull request can only be re-read
              from the host holding it, so this dialog cannot show them here.
            </p>
          )}
          {summary.isPending && entry.run_id !== null && owned ? <Skeleton height={140} /> : null}
          {summary.isError ? (
            <ErrorState
              variant="inline"
              title="Couldn’t read this workspace"
              onRetry={() => void summary.refetch()}
            />
          ) : null}
          {summary.data ? <WorkspaceClosureEvidence summary={summary.data} /> : null}
          {blocked ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {entry.reason} {workspaceBlockerAction(entry.blocker)}
            </p>
          ) : null}
          {cleanup.isError ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {cleanupWorkspaceErrorMessage(cleanup.error)}
            </p>
          ) : null}
          {cleanup.data !== undefined && cleanup.data.outcome !== "cleaned" ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {cleanup.data.message}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={cleanup.isPending}
            disabled={blocked || cleanup.isPending}
            onClick={() =>
              cleanup.mutate(
                { hostId, worktreeId: entry.id },
                {
                  onSuccess: (result) => {
                    if (result.outcome === "cleaned") onOpenChange(false);
                  },
                },
              )
            }
          >
            Delete workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
