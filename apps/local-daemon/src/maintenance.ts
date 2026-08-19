import { startIntervalPass, type IntervalPass, type Supervisor } from "#supervisor";

/** Slow enough to stay a maintenance pass rather than a poller, short enough that a merge is noticed within a work break. */
const WORKSPACE_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

/** The durable rows are the queue, so this only bounds how late a scheduled resume can be — nothing against a quota window measured in hours. */
const PROVIDER_RESUME_INTERVAL_MS = 30 * 1000;

/**
 * Both passes run once at startup and then on their own cadence, so a daemon that
 * was down over a merge or a quota reset picks it up as soon as it is back.
 */
export function startMaintenancePasses(supervisor: Supervisor): IntervalPass {
  const workspaces = startIntervalPass(
    "workspace reconciliation",
    async () => {
      await supervisor.reconcileWorkspaces();
    },
    WORKSPACE_RECONCILE_INTERVAL_MS,
  );
  const providerResumes = startIntervalPass(
    "provider resume",
    async () => {
      const resumed = await supervisor.resumeDueProviderWaits();
      if (resumed > 0) console.log(`[otomat] resumed ${resumed} run(s) whose provider reopened`);
    },
    PROVIDER_RESUME_INTERVAL_MS,
  );
  return {
    stop: () => {
      workspaces.stop();
      providerResumes.stop();
    },
  };
}
