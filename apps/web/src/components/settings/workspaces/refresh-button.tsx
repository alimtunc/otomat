import type { ExecutionHostId } from "@otomat/domain";
import { Button, Icon, Tooltip, TooltipContent, TooltipTrigger } from "@otomat/ui";
import { useReconcileWorkspaces } from "@web/api/workspaces/mutations";
import { plural } from "@web/lib/plural";

export function RefreshWorkspacesButton({
  hostId,
  descriptionId,
}: {
  hostId: ExecutionHostId;
  descriptionId: string;
}) {
  const refresh = useReconcileWorkspaces();
  const report = refresh.data;
  return (
    <div className="relative flex min-w-0 flex-col items-end gap-1">
      <Tooltip>
        <TooltipTrigger
          delay={300}
          render={
            <Button
              variant="outline"
              size="sm"
              aria-describedby={descriptionId}
              loading={refresh.isPending}
              disabled={refresh.isPending}
              onClick={() => refresh.mutate(hostId)}
            />
          }
        >
          <Icon name="refresh-cw" aria-hidden />
          Refresh worktrees
        </TooltipTrigger>
        <TooltipContent>
          Rescan Git worktrees and refresh this list. Does not delete or change any worktree.
        </TooltipContent>
      </Tooltip>
      {refresh.isError ? (
        <span role="alert" className="text-xs text-danger">
          Refresh failed — is this host's daemon running?
        </span>
      ) : null}
      {report ? (
        <span role="status" className="text-right text-xs text-text-tertiary">
          {`${plural(report.pull_requests_refreshed, "pull request")} re-read · ${plural(report.pruned, "gone registration")} pruned · ${plural(report.converged, "record")} converged`}
        </span>
      ) : null}
    </div>
  );
}
