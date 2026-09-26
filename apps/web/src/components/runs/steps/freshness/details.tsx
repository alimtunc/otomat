import {
  WORKSPACE_UPDATE_BLOCKED,
  type ComparedWorkspaceFreshness,
  type UpdateWorkspaceRequest,
  type WorkspaceFreshness,
} from "@otomat/domain";
import { Button, Chip } from "@otomat/ui";
import type { UseMutationResult } from "@tanstack/react-query";
import { BaseRemoteRefusal } from "@web/components/runs/launch/base/remote-refusal";
import { WorkspaceUpdateRefusal } from "@web/components/runs/steps/freshness/update-refusal";
import {
  FRESHNESS_CHIPS,
  freshnessActions,
  freshnessDetails,
} from "@web/lib/run/workspace-freshness";

export interface WorkspaceFreshnessDetailsProps {
  freshness: WorkspaceFreshness;
  update: UseMutationResult<WorkspaceFreshness, Error, UpdateWorkspaceRequest>;
  busy: boolean;
  onRecheck: () => void;
}

function updateBlocker(freshness: ComparedWorkspaceFreshness, busy: boolean): string | null {
  if (busy) return WORKSPACE_UPDATE_BLOCKED.run_active;
  return freshness.dirty ? WORKSPACE_UPDATE_BLOCKED.workspace_dirty : null;
}

export function WorkspaceFreshnessDetails({
  freshness,
  update,
  busy,
  onRecheck,
}: WorkspaceFreshnessDetailsProps) {
  const chip = FRESHNESS_CHIPS[freshness.state];
  const status = <Chip tone={chip.tone}>{chip.label}</Chip>;
  if (freshness.state === "unverifiable") {
    return (
      <>
        {status}
        <BaseRemoteRefusal refusal={freshness.failure} onRetry={onRecheck} />
      </>
    );
  }
  const actions = freshnessActions(freshness);
  const attempted = update.variables;
  const blocked = updateBlocker(freshness, busy);

  return (
    <>
      {status}
      {freshnessDetails(freshness).map((line) => (
        <p key={line} className="text-xs text-text-secondary">
          {line}
        </p>
      ))}
      {actions.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="outline"
              size="xs"
              disabled={blocked !== null || update.isPending}
              loading={
                update.isPending &&
                attempted?.source === action.request.source &&
                attempted.strategy === action.request.strategy
              }
              onClick={() => update.mutate(action.request)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {actions.length === 0 || blocked === null ? null : (
        <p className="text-xs text-text-tertiary">{blocked}</p>
      )}
      {update.error === null ? null : (
        <WorkspaceUpdateRefusal
          error={update.error}
          attempted={attempted}
          freshness={freshness}
          onRecheck={onRecheck}
        />
      )}
    </>
  );
}
