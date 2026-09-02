import { Button, Chip, Icon, RelativeTime, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useWorkspacesForRun } from "@web/api/workspaces/queries";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import {
  RailMeta,
  RailRow,
  RailSection,
} from "@web/components/issues/workspace/rail/rail-primitives";
import { WorkspaceActions } from "@web/components/issues/workspace/rail/workspace/actions";
import { CopyablePath } from "@web/components/runs/copyable-path";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { workspaceReason } from "@web/lib/workspace/blocker";
import { WORKSPACE_STATE } from "@web/lib/workspace/state";

export function WorkspaceSection({ runId }: { runId: string }) {
  const workspaces = useWorkspacesForRun(runId);

  return (
    <RailSection title="Workspace">
      <QueryBoundary
        query={workspaces}
        pending={<Skeleton height={96} />}
        error={
          <ErrorReport
            error={workspaces.error}
            context="Couldn’t read this run’s workspace"
            onRetry={() => void workspaces.refetch()}
          />
        }
      >
        {(inventory) => {
          const entry = inventory.entries.at(0);
          if (entry === undefined) return null;
          const state = WORKSPACE_STATE[entry.state];
          return (
            <>
              <RailMeta>
                <RailRow label="State">
                  <Chip tone={state.tone}>{state.label}</Chip>
                </RailRow>
                <RailRow label="Branch">
                  <span className="truncate font-mono text-xs text-text-secondary">
                    {entry.branch ?? "detached"}
                  </span>
                </RailRow>
                <RailRow label="Path">
                  <CopyablePath value={entry.path} label="Worktree path" />
                </RailRow>
                <RailRow label={entry.state === "removed" ? "Cleaned" : "Last activity"}>
                  {entry.last_activity_at === null ? (
                    <span className="text-xs text-text-tertiary">unknown</span>
                  ) : (
                    <span className="text-xs text-text-secondary">
                      <RelativeTime date={entry.last_activity_at} />
                    </span>
                  )}
                </RailRow>
              </RailMeta>
              <p className="mt-2.5 mb-0 text-xs text-text-tertiary">{workspaceReason(entry)}</p>
              <WorkspaceActions entry={entry} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 w-full"
                render={
                  <Link to="/settings/project/workspaces">
                    <Icon name="layers" aria-hidden />
                    All workspaces
                  </Link>
                }
              />
            </>
          );
        }}
      </QueryBoundary>
    </RailSection>
  );
}
