import { useDaemonStatus, useHealth } from "@web/api/daemon/queries";
import { useReviewQueue } from "@web/api/reviews/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { remoteStatusHeadline } from "@web/components/shell/remote-session/status-labels";
import { isRunning } from "@web/lib/run/filters";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const switcher = useProjectSwitcher();
  const runs = useProjectRuns(switcher.currentProjectId);
  const reviews = useReviewQueue(switcher.currentProjectId);
  const remote = useRemoteSession();

  return {
    // A host still working its journey through is progress, not a dead daemon: the poll fails
    // throughout a 20–30s bootstrap and an update restarts the daemon on purpose.
    connectionState: remote.settling ? ("reconnecting" as const) : connectionState,
    connectionLabel:
      remote.settling && remote.status !== null
        ? remoteStatusHeadline(remote.status, remote.alias)
        : undefined,
    lastSyncAt,
    retry,
    daemonVersion: health.data?.version,
    ...switcher,
    hasLiveRun: (runs.data ?? []).some(isRunning),
    reviewCount: (reviews.data ?? []).length,
  };
}
