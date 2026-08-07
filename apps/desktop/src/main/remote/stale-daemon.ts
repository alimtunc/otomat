import { remoteIsIdle } from "./idle.js";
import type { RemoteSessionHandle } from "./session.js";

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
      const idle = await remoteIsIdle({
        baseUrl: session.url,
        fetchImpl: this.options.fetchImpl,
        log: this.options.log,
      });
      if (!idle) return;
      this.options.log(
        `Remote daemon build ${build} differs from expected ${expected}; restarting it while idle.`,
      );
      await session.refreshDaemon();
      // Only a delivered restart consumes this build's one attempt; a thrown stop leaves it open for the next poll.
      this.handledBuild = build;
    } catch (error) {
      this.options.log(`Stale remote daemon refresh failed: ${String(error)}`);
    } finally {
      this.refreshing = false;
    }
  }
}
