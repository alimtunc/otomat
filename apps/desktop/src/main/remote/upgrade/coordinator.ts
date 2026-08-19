import type { RemoteHostStatus } from "@otomat/domain";

import { BUILD_SHA, type RemoteDeployment } from "../bootstrap/scripts.js";
import { trimDetail } from "../bootstrap/status.js";
import { remoteBusyRuns } from "../idle.js";
import type { RemoteSessionHandle } from "../session.js";
import { runSshScript } from "../ssh/script.js";
import { ArtifactWait } from "./artifact-wait.js";
import {
  describeArtifactFailure,
  describeArtifactTimeout,
  describeArtifactWait,
  probeArtifact,
  type ArtifactAvailability,
  type ArtifactWaitReason,
} from "./artifact.js";
import { upgradeRemoteDaemon, type RemoteUpdateResult } from "./daemon.js";

const RECHECK_DELAY_MS = 15_000;

const NO_BUILD = "This build cannot name its own commit; deploy manually.";
const NO_ALIAS = "No remote host is configured.";
const NOT_CONNECTED = "The remote host is not connected yet. Try again once its tunnel is up.";
const IN_PROGRESS = "A daemon update is already running on this host.";

export interface RemoteUpgradeCoordinatorOptions {
  /** Build this app expects on the host; null leaves every daemon alone. */
  expectedBuild: string | null;
  /** The deployment this app drives, and therefore the one an update may replace. */
  deployment: RemoteDeployment;
  /** GitHub `owner/repo` whose CI publishes `otomat-daemon-<build>-linux-x64`. */
  repo: string;
  alias(): string | null;
  session(): RemoteSessionHandle | null;
  /** Fires whenever the journey's own phase changes, so the host status is re-published. */
  onStatus(): void;
  log(message: string): void;
  runScript?: typeof runSshScript | undefined;
  fetchImpl?: typeof fetch | undefined;
  scheduleRecheck?:
    | ((callback: () => void, delayMs: number) => NodeJS.Timeout | number)
    | undefined;
}

/**
 * The daemon half of a host's journey: compare the build the host answers with against the one this
 * app expects, wait out the runs in flight, wait for CI to publish the matching bundle, install it
 * and verify the restart. It runs itself from every `connected` transition — a client closed
 * mid-wait simply picks the journey back up on its next launch — while the manual command stays the
 * way to retry a failure.
 *
 * One automatic attempt per stale build once something has actually gone wrong: a failed install
 * leaves the old daemon and its database running and keeps its reason. A bundle CI has not published
 * yet is not that failure — it is waited out on `ArtifactWait`'s bounded schedule.
 */
export class RemoteUpgradeCoordinator {
  private journey: RemoteHostStatus | null = null;
  /** The last attempt that stopped, against the build it left running: that pair is the retry memory. */
  private failure: { build: string | null; message: string } | null = null;
  private timer: NodeJS.Timeout | number | null = null;
  private running = false;
  private readonly artifact = new ArtifactWait();

  constructor(private readonly options: RemoteUpgradeCoordinatorOptions) {}

  /** The phase the journey owns the host with, or null while the session speaks for itself. */
  get status(): RemoteHostStatus | null {
    return this.journey;
  }

  /** Why the last automatic attempt stopped, when one did; cleared by a successful update. */
  get error(): string | null {
    return this.failure?.message ?? null;
  }

  observe(): void {
    void this.run(false);
  }

  /** The manual command: forgets both memories, so a rebuilt artifact installs right away. */
  update(): Promise<RemoteUpdateResult> {
    this.failure = null;
    this.artifact.reset();
    return this.run(true);
  }

  stop(): void {
    this.cancelRecheck();
    this.publish(null);
  }

  private async run(manual: boolean): Promise<RemoteUpdateResult> {
    if (this.running) return { ok: false, message: IN_PROGRESS };
    // An armed re-check already owns the journey: a reconnect resumes its schedule, never restarts it.
    if (!manual && this.timer !== null) return { ok: true };
    this.cancelRecheck();
    // A journey that cannot go on stops speaking for the host, which its own status then describes.
    const expected = this.options.expectedBuild;
    if (expected === null || !BUILD_SHA.test(expected)) {
      return this.rest({ ok: false, message: NO_BUILD });
    }
    const alias = this.options.alias();
    if (alias === null) return this.rest({ ok: false, message: NO_ALIAS });
    const session = this.options.session();
    if (session === null) return this.rest({ ok: false, message: NOT_CONNECTED });
    this.running = true;
    try {
      return await this.drive(alias, expected, session, manual);
    } catch (error) {
      return this.fail(trimDetail(String(error)), null);
    } finally {
      this.running = false;
    }
  }

  private async drive(
    alias: string,
    expected: string,
    session: RemoteSessionHandle,
    manual: boolean,
  ): Promise<RemoteUpdateResult> {
    const url = session.status.phase === "connected" ? session.url : null;
    const stale = session.remoteBuild;
    if (!manual) {
      if (url === null || stale === null || stale === expected) return this.rest({ ok: true });
      const failed = this.failure;
      if (failed !== null && failed.build === stale) {
        return this.rest({ ok: false, message: failed.message });
      }
      // Only entering the journey announces the check; a 15s re-check keeps `waiting_for_runs` up.
      if (this.journey === null) this.publish({ phase: "checking_version", detail: null });
    }
    // Both waits belong to a connected host: they hold a running daemon, and the tunnel serves on.
    if (url !== null) {
      const busy = await remoteBusyRuns({
        baseUrl: url,
        fetchImpl: this.options.fetchImpl ?? fetch,
        log: this.options.log,
      });
      if (busy === null || busy > 0) return this.waitForRuns(busy);
      const availability = await probeArtifact({
        alias,
        build: expected,
        repo: this.options.repo,
        runScript: this.options.runScript ?? runSshScript,
      });
      if (availability.kind !== "ready") return this.holdOrFail(availability, expected, stale);
      this.artifact.reset();
    }
    this.publish({ phase: "installing_update", detail: expected });
    const result = await upgradeRemoteDaemon({
      alias,
      deployment: this.options.deployment,
      build: expected,
      repo: this.options.repo,
      session,
      runScript: this.options.runScript ?? runSshScript,
      onVerifying: () => this.publish({ phase: "verifying_update", detail: expected }),
      log: this.options.log,
    });
    if (!result.ok) return this.fail(result.message, stale);
    this.failure = null;
    return this.rest(result);
  }

  /**
   * Holds the update until the host is idle, saying what it is holding for. An unreadable answer
   * counts as busy — a daemon that cannot list its runs must not have its bundle swapped.
   */
  private waitForRuns(busy: number | null): RemoteUpdateResult {
    this.publish({
      phase: "waiting_for_runs",
      active_runs: busy ?? 0,
      detail: busy === null ? "the daemon did not answer" : null,
    });
    this.arm(RECHECK_DELAY_MS);
    return { ok: true };
  }

  /** A probe that could not answer is waited out too: one ssh or `gh` blip must not cost the click. */
  private holdOrFail(
    availability: Exclude<ArtifactAvailability, { kind: "ready" }>,
    build: string,
    stale: string | null,
  ): RemoteUpdateResult {
    if (availability.kind === "pending") {
      return (
        this.hold(build, availability.reason) ??
        this.fail(describeArtifactTimeout(availability.reason, build), stale)
      );
    }
    if (availability.kind === "query_failed") {
      const held = this.hold(build, "unreadable");
      if (held !== null) return held;
    }
    return this.fail(describeArtifactFailure(availability, build), stale);
  }

  /** Waiting is progress, not a failure — null once the window for this reason is spent. */
  private hold(build: string, reason: ArtifactWaitReason): RemoteUpdateResult | null {
    const delay = this.artifact.next(build, reason);
    if (delay === null) return null;
    this.publish({ phase: "waiting_for_artifact", detail: describeArtifactWait(reason) });
    this.arm(delay);
    return { ok: true };
  }

  private arm(delayMs: number): void {
    const schedule = this.options.scheduleRecheck ?? ((callback, ms) => setTimeout(callback, ms));
    this.timer = schedule(() => {
      this.timer = null;
      void this.run(false);
    }, delayMs);
  }

  private fail(message: string, build: string | null): RemoteUpdateResult {
    this.failure = { build, message };
    this.options.log(`Remote daemon update stopped: ${message}`);
    this.publish(null);
    return { ok: false, message };
  }

  private rest(result: RemoteUpdateResult): RemoteUpdateResult {
    this.publish(null);
    return result;
  }

  private publish(status: RemoteHostStatus | null): void {
    this.journey = status;
    this.options.onStatus();
  }

  private cancelRecheck(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
