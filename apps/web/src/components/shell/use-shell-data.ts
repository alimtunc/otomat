import { useDaemonStatus, useHealth } from "@web/api/daemon/queries";
import { useProjectRuns } from "@web/api/runs/queries";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { isReviewable, isRunning } from "@web/lib/run/filters";

export function useShellData() {
  const { connectionState, lastSyncAt, retry } = useDaemonStatus();
  const health = useHealth();
  const switcher = useProjectSwitcher();
  const runs = useProjectRuns(switcher.currentProjectId);

  return {
    connectionState,
    lastSyncAt,
    retry,
    daemonVersion: health.data?.version,
    ...switcher,
    hasLiveRun: (runs.data ?? []).some(isRunning),
    reviewCount: (runs.data ?? []).filter(isReviewable).length,
  };
}
