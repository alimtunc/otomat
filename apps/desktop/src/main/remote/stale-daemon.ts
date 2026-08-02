import type { RemoteSessionHandle } from "./session.js";

/** States with a live or pending provider process; a restart would cut real work. */
const BUSY_RUN_STATUSES = new Set(["queued", "preparing", "running", "awaiting_permission"]);

export interface StaleDaemonRefresherOptions {
  /** Build this app expects; null disables refreshing entirely. */
  expectedBuild: string | null;
  fetchImpl: typeof fetch;
  log(message: string): void;
}

/**
 * Restarts a stale remote daemon as soon as it is idle, so a redeployed entry
 * actually boots without manual intervention. One attempt per observed stale
 * build: a restart that stays stale means the deploy directory itself is old,
 * which only a redeploy on the host can fix (the Settings warning stays up).
 */
export class StaleDaemonRefresher {
  private refreshing = false;
  private handledBuild: string | null = null;

  constructor(private readonly options: StaleDaemonRefresherOptions) {}

  async maybeRefresh(session: RemoteSessionHandle | null): Promise<void> {
    const expected = this.options.expectedBuild;
    if (session === null || expected === null || this.refreshing) return;
    if (session.status.phase !== "connected" || session.url === null) return;
    const build = session.remoteBuild;
    if (build === null || build === expected || build === this.handledBuild) return;
    this.refreshing = true;
    try {
      if (!(await this.remoteIsIdle(session.url))) return;
      this.options.log(
        `Remote daemon build ${build} differs from expected ${expected}; restarting it while idle.`,
      );
      this.handledBuild = build;
      await session.refreshDaemon();
    } catch (error) {
      this.options.log(`Stale remote daemon refresh failed: ${String(error)}`);
    } finally {
      this.refreshing = false;
    }
  }

  private async remoteIsIdle(baseUrl: string): Promise<boolean> {
    try {
      const response = await this.options.fetchImpl(`${baseUrl}/api/runs`);
      if (!response.ok) return false;
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) return false;
      return !payload.some((run) =>
        BUSY_RUN_STATUSES.has((run as { status?: string }).status ?? ""),
      );
    } catch (error) {
      // Unreachable is not idle: when in doubt, never restart.
      this.options.log(`Remote idle check failed: ${String(error)}`);
      return false;
    }
  }
}
