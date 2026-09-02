import type { ExecutionHostId } from "@otomat/domain";
import { Button, Icon, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import { useReconcileWorkspaces } from "@web/api/workspaces/mutations";
import { useId } from "react";

const EFFECT =
  "Re-reads this host's pull requests and git worktree list, refreshes every workspace state, and drops git registrations whose directory is gone. Nothing on disk is deleted, except a clean worktree whose pull request is merged while automatic deletion is on.";

export function ReconcileWorkspacesButton({ hostId }: { hostId: ExecutionHostId }) {
  const reconcile = useReconcileWorkspaces();
  const effectId = useId();
  const report = reconcile.data;
  return (
    <div className="relative flex min-w-0 flex-col items-end gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-describedby={effectId}
              loading={reconcile.isPending}
              disabled={reconcile.isPending}
              onClick={() => reconcile.mutate(hostId)}
            >
              <Icon name="refresh-cw" aria-hidden />
              Reconcile worktrees
            </Button>
          }
        />
        <TooltipContent className="max-w-80 whitespace-normal">{EFFECT}</TooltipContent>
      </Tooltip>
      <span id={effectId} className="sr-only">
        {EFFECT}
      </span>
      {reconcile.isError ? (
        <span role="alert" className="text-xs text-danger">
          Reconciliation failed — is this host's daemon running?
        </span>
      ) : null}
      {report ? (
        <span role="status" className="text-right text-xs text-text-tertiary">
          {`${report.pull_requests_refreshed} pull request(s) re-read · ${report.pruned} pruned · ${report.converged} converged · ${report.cleaned} cleaned · ${report.skipped} skipped · ${report.failed} failed`}
        </span>
      ) : null}
    </div>
  );
}
