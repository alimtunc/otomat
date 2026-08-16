import type { IssueContract } from "@otomat/domain";
import { DialogBody, Skeleton } from "@otomat/ui";
import { ErrorReport } from "@web/components/diagnostics/error-report";
import { LaunchBlockedPanel } from "@web/components/runs/launch/launch-blocked-panel";
import { RepositoryChoice } from "@web/components/runs/launch/repository-choice";
import {
  useLaunchTarget,
  type ReadyLaunchTarget,
} from "@web/components/runs/launch/use-launch-target";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import type { ReactNode } from "react";

export interface LaunchTargetGateProps {
  /** Project the run would execute in; `undefined` means none is selected yet. */
  projectId: string | undefined;
  /** Present when launching on an existing issue, which unlocks moving it to another project. */
  issue?: IssueContract;
  children: (target: ReadyLaunchTarget) => ReactNode;
}

/**
 * The one gate every launch surface passes through. Nothing that can create a
 * run renders until a real repository and base branch are resolved, so a run is
 * never started without the worktree it is supposed to work in.
 */
export function LaunchTargetGate({ projectId, issue, children }: LaunchTargetGateProps) {
  const { updatePending } = useRemoteSession();
  if (updatePending) {
    return (
      <DialogBody>
        <LaunchBlockedPanel projectId={projectId ?? null} blocker="daemon_update_pending" />
      </DialogBody>
    );
  }
  if (projectId === undefined) {
    return (
      <DialogBody>
        <LaunchBlockedPanel projectId={null} blocker="no_project" />
      </DialogBody>
    );
  }
  return (
    <ResolvedLaunchTargetGate projectId={projectId} issue={issue}>
      {children}
    </ResolvedLaunchTargetGate>
  );
}

function ResolvedLaunchTargetGate({
  projectId,
  issue,
  children,
}: {
  projectId: string;
  issue: IssueContract | undefined;
  children: LaunchTargetGateProps["children"];
}) {
  const target = useLaunchTarget(projectId);

  if (target.status === "loading") {
    return (
      <DialogBody>
        <Skeleton className="h-40 w-full" />
      </DialogBody>
    );
  }
  if (target.status === "error") {
    return (
      <DialogBody>
        <ErrorReport
          error={target.error}
          context="Couldn’t load this project’s repository"
          onRetry={target.retry}
        />
      </DialogBody>
    );
  }
  if (target.status === "blocked") {
    return (
      <DialogBody>
        <LaunchBlockedPanel projectId={projectId} blocker={target.blocker} issue={issue} />
      </DialogBody>
    );
  }
  if (target.status === "ambiguous") {
    return (
      <DialogBody>
        <RepositoryChoice target={target} />
      </DialogBody>
    );
  }
  return children(target);
}
