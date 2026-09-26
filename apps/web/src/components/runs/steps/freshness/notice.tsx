import type { UpdateWorkspaceRequest, WorkspaceFreshness } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { WorkspaceFreshnessDetails } from "@web/components/runs/steps/freshness/details";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { daemonErrorMessage } from "@web/lib/daemon-error";

export interface WorkspaceFreshnessNoticeProps {
  freshness: UseQueryResult<WorkspaceFreshness>;
  update: UseMutationResult<WorkspaceFreshness, Error, UpdateWorkspaceRequest>;
  busy: boolean;
}

export function WorkspaceFreshnessNotice({
  freshness,
  update,
  busy,
}: WorkspaceFreshnessNoticeProps) {
  const recheck = () => {
    update.reset();
    void freshness.refetch();
  };

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-border bg-surface-2 p-3">
      <div className="flex w-full items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Icon name="git-merge" aria-hidden className="h-3.5 w-3.5 text-text-tertiary" />
          <span>Compared with the remote</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          loading={freshness.isFetching}
          disabled={update.isPending}
          onClick={recheck}
        >
          Check again
        </Button>
      </div>
      <QueryBoundary
        query={freshness}
        pending={<p className="text-xs text-text-tertiary">Fetching the branch and its base…</p>}
        error={
          <p role="alert" className="text-xs text-danger">
            {daemonErrorMessage(
              freshness.error,
              "The daemon could not check this workspace against its remote.",
            )}
          </p>
        }
      >
        {(data) => (
          <WorkspaceFreshnessDetails
            freshness={data}
            update={update}
            busy={busy}
            onRecheck={recheck}
          />
        )}
      </QueryBoundary>
    </div>
  );
}
