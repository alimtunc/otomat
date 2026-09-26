import type { ComparedWorkspaceFreshness, UpdateWorkspaceRequest } from "@otomat/domain";
import { BaseRemoteRefusal } from "@web/components/runs/launch/base/remote-refusal";
import { daemonErrorMessage } from "@web/lib/daemon-error";
import { conflictAdvice, workspaceUpdateRefusal } from "@web/lib/run/workspace-freshness";

export interface WorkspaceUpdateRefusalProps {
  error: Error;
  attempted: UpdateWorkspaceRequest | undefined;
  freshness: ComparedWorkspaceFreshness;
  onRecheck: () => void;
}

export function WorkspaceUpdateRefusal({
  error,
  attempted,
  freshness,
  onRecheck,
}: WorkspaceUpdateRefusalProps) {
  const refusal = workspaceUpdateRefusal(error);
  if (refusal?.remote) {
    return (
      <BaseRemoteRefusal
        refusal={{ message: refusal.message, remote: refusal.remote }}
        onRetry={onRecheck}
      />
    );
  }
  const ref = attempted ? freshness[attempted.source]?.ref : undefined;
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-md border border-danger/40 bg-danger-bg p-2.5 text-xs"
    >
      <p className="text-danger">
        {daemonErrorMessage(
          error,
          "Could not update the workspace — the daemon refused it.",
          "Could not update the workspace — is the daemon running?",
        )}
      </p>
      {refusal?.conflicts.length ? (
        <p className="text-text-secondary">Conflicting: {refusal.conflicts.join(", ")}</p>
      ) : null}
      {refusal?.error === "update_conflict" && attempted && ref ? (
        <p className="text-text-secondary">{conflictAdvice(attempted.strategy, ref)}</p>
      ) : null}
    </div>
  );
}
