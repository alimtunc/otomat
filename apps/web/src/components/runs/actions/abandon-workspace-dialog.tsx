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
import { useAbandonWorkspace } from "@web/api/runs/mutations";
import { useRunWorkspace } from "@web/api/runs/queries";
import { WorkspaceClosureEvidence } from "@web/components/runs/actions/workspace-closure-evidence";

export interface AbandonWorkspaceDialogProps {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BLOCKER_NOTE = {
  run_active: "Cancel the run first — a live turn is still writing in this worktree.",
  workspace_closed: "This run no longer holds its issue's workspace, so there is nothing to close.",
} as const;

export function AbandonWorkspaceDialog({ runId, open, onOpenChange }: AbandonWorkspaceDialogProps) {
  const summary = useRunWorkspace(runId, open);
  const abandon = useAbandonWorkspace(runId);
  const blocker = summary.data?.blocker ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Abandon this workspace">
        <DialogHeader>
          <DialogTitle>Abandon workspace</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text-secondary">
            This ends the issue’s work cycle. Nothing is deleted: the branch, its commits and this
            run stay readable, and the next launch starts a fresh cycle from a base you pick again.
          </p>
          {summary.isPending ? <Skeleton height={140} /> : null}
          {summary.isError ? (
            <ErrorState
              variant="inline"
              title="Couldn’t read this workspace"
              onRetry={() => void summary.refetch()}
            />
          ) : null}
          {summary.data ? <WorkspaceClosureEvidence summary={summary.data} /> : null}
          {blocker ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {BLOCKER_NOTE[blocker]}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Keep working
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={abandon.isPending}
            disabled={summary.data === undefined || blocker !== null || abandon.isPending}
            onClick={() => abandon.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
          >
            Abandon workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
