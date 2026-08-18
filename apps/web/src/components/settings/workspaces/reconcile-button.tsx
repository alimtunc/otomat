import { Button, Icon } from "@otomat/ui";
import { useReconcileWorkspaces } from "@web/api/workspaces/mutations";

export function ReconcileWorkspacesButton() {
  const reconcile = useReconcileWorkspaces();
  const report = reconcile.data;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        loading={reconcile.isPending}
        disabled={reconcile.isPending}
        onClick={() => reconcile.mutate()}
      >
        <Icon name="refresh-cw" aria-hidden />
        Reconcile worktrees
      </Button>
      {reconcile.isError ? (
        <span role="alert" className="text-xs text-danger">
          Reconciliation failed — is the daemon running?
        </span>
      ) : null}
      {report ? (
        <span role="status" className="truncate text-xs text-text-tertiary">
          {`${report.pull_requests_refreshed} pull request(s) re-read · ${report.pruned} pruned · ${report.converged} converged · ${report.cleaned} cleaned · ${report.skipped} skipped · ${report.failed} failed`}
        </span>
      ) : null}
    </div>
  );
}
