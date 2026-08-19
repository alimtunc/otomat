import type { RemoteHostStatus } from "@otomat/domain";

import { waitForHealth } from "#shared/health";
import { findFreeLoopbackPort } from "#shared/ports";

import {
  startOrVerifyDaemonScript,
  stopDaemonScript,
  type RemoteDeployment,
} from "./bootstrap/scripts.js";
import {
  resolveBootstrapResult,
  trimDetail,
  type BootstrapResolution,
  type RemoteErrorStatus,
} from "./bootstrap/status.js";
import { ReconnectLoop } from "./reconnect.js";
import { runSshScript } from "./ssh/script.js";
import { SshTunnel, type SshTunnelOptions, type TunnelHandle } from "./ssh/tunnel.js";

const BOOTSTRAP_TIMEOUT_MS = 30_000;
const TUNNEL_HEALTH_TIMEOUT_MS = 15_000;

export interface RemoteSessionOptions {
  alias: string;
  /** Daemon location and port on the host. */
  deployment: RemoteDeployment;
  log(message: string): void;
  onStatus(status: RemoteHostStatus): void;
  runScript?: typeof runSshScript;
  createTunnel?: (options: SshTunnelOptions) => TunnelHandle;
  health?: typeof waitForHealth;
  reservePort?: typeof findFreeLoopbackPort;
  scheduleRetry?: (callback: () => void, delayMs: number) => NodeJS.Timeout | number;
}

export interface RemoteSessionHandle {
  readonly alias: string;
  readonly status: RemoteHostStatus;
  readonly url: string | null;
  readonly remoteBuild: string | null;
  ensureLocalPort(): Promise<number>;
  connect(retryOnFailure: boolean): Promise<RemoteHostStatus>;
  refreshDaemon(): Promise<RemoteHostStatus>;
  dispose(): Promise<void>;
}

// `connected` is declared only after a health response came back through the tunnel; the remote daemon is never stopped from here — durability is the point.
export class RemoteHostSession implements RemoteSessionHandle {
  private currentStatus: RemoteHostStatus = { phase: "disconnected", detail: null };
  private localPort: number | null = null;
  private tunnel: TunnelHandle | null = null;
  private disposed = false;
  private inFlight: Promise<RemoteHostStatus> | null = null;
  private lastRemoteBuild: string | null = null;
  private readonly retry: ReconnectLoop;

  constructor(private readonly options: RemoteSessionOptions) {
    this.retry = new ReconnectLoop({
      attempt: () => void this.connect(true),
      schedule: options.scheduleRetry,
    });
  }

  get alias(): string {
    return this.options.alias;
  }

  get remoteBuild(): string | null {
    return this.lastRemoteBuild;
  }

  get status(): RemoteHostStatus {
    return this.currentStatus;
  }

  get url(): string | null {
    return this.localPort === null ? null : `http://127.0.0.1:${this.localPort}`;
  }

  async ensureLocalPort(): Promise<number> {
    this.localPort ??= await (this.options.reservePort ?? findFreeLoopbackPort)();
    return this.localPort;
  }

  /** `retryOnFailure` keeps a failed attempt cycling through the reconnect loop instead of settling on `error`. */
  async connect(retryOnFailure: boolean): Promise<RemoteHostStatus> {
    if (this.disposed) return this.currentStatus;
    if (this.currentStatus.phase === "connected") return this.currentStatus;
    if (this.inFlight !== null) return this.inFlight;
    this.retry.cancel();
    this.inFlight = this.attempt(retryOnFailure).finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  async refreshDaemon(): Promise<RemoteHostStatus> {
    if (this.disposed || this.inFlight !== null) return this.currentStatus;
    this.retry.cancel();
    const run = this.options.runScript ?? runSshScript;
    const stop = await run({
      alias: this.options.alias,
      script: stopDaemonScript(this.options.deployment),
      timeoutMs: BOOTSTRAP_TIMEOUT_MS,
    });
    if (stop.code !== 0) {
      throw new Error(`remote daemon stop exited ${String(stop.code)}: ${trimDetail(stop.stderr)}`);
    }
    await this.stopTunnel();
    this.setStatus({ phase: "disconnected", detail: null });
    return this.connect(true);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.retry.cancel();
    await this.stopTunnel();
    this.setStatus({ phase: "disconnected", detail: null });
  }

  private async stopTunnel(): Promise<void> {
    const tunnel = this.tunnel;
    this.tunnel = null;
    if (tunnel !== null) await tunnel.stop();
  }

  private async attempt(retryOnFailure: boolean): Promise<RemoteHostStatus> {
    try {
      const localPort = await this.ensureLocalPort();
      const bootstrap = await this.bootstrapDaemon();
      if (this.disposed) return this.settleDisposed();
      if ("failure" in bootstrap) return this.settleFailure(bootstrap.failure, retryOnFailure);
      const tunnelFailure = await this.openTunnel(localPort);
      if (tunnelFailure !== null) return this.settleFailure(tunnelFailure, retryOnFailure);
      if (this.disposed) {
        await this.stopTunnel();
        return this.settleDisposed();
      }
      this.retry.reset();
      this.setStatus({ phase: "connected", detail: bootstrap.detail });
      return this.currentStatus;
    } catch (error) {
      return this.settleFailure(
        { phase: "error", code: "ssh_unreachable", detail: trimDetail(String(error)) },
        retryOnFailure,
      );
    }
  }

  private async bootstrapDaemon(): Promise<BootstrapResolution> {
    this.setProgress({ phase: "checking_host", detail: `ssh ${this.options.alias}` });
    const run = this.options.runScript ?? runSshScript;
    const result = await run({
      alias: this.options.alias,
      script: startOrVerifyDaemonScript(this.options.deployment),
      timeoutMs: BOOTSTRAP_TIMEOUT_MS,
    });
    const resolution = resolveBootstrapResult(result);
    if ("failure" in resolution) return resolution;
    this.setProgress({ phase: "starting_daemon", detail: resolution.detail });
    return resolution;
  }

  private async openTunnel(localPort: number): Promise<RemoteErrorStatus | null> {
    this.setProgress({ phase: "opening_tunnel", detail: `127.0.0.1:${localPort}` });
    const abort = new AbortController();
    let exitDetail: string | null = null;
    const createTunnel =
      this.options.createTunnel ?? ((options: SshTunnelOptions) => new SshTunnel(options));
    const tunnel = createTunnel({
      alias: this.options.alias,
      localPort,
      remotePort: this.options.deployment.port,
      onExit: (info) => {
        if (info.expected || this.disposed) return;
        exitDetail = info.stderrTail || `ssh tunnel exited with code ${String(info.code)}`;
        abort.abort();
        this.onTunnelDropped(exitDetail);
      },
    });
    this.tunnel = tunnel;
    tunnel.start();
    try {
      const health = await (this.options.health ?? waitForHealth)({
        url: `http://127.0.0.1:${localPort}/api/health`,
        timeoutMs: TUNNEL_HEALTH_TIMEOUT_MS,
        signal: abort.signal,
      });
      this.lastRemoteBuild = health.build;
      return null;
    } catch (error) {
      this.tunnel = null;
      await tunnel.stop();
      if (exitDetail !== null) {
        return { phase: "error", code: "tunnel_failed", detail: trimDetail(exitDetail) };
      }
      return { phase: "error", code: "health_failed", detail: trimDetail(String(error)) };
    }
  }

  private settleDisposed(): RemoteHostStatus {
    this.setStatus({ phase: "disconnected", detail: null });
    return this.currentStatus;
  }

  private onTunnelDropped(detail: string): void {
    this.tunnel = null;
    if (this.currentStatus.phase !== "connected") return;
    this.options.log(`Remote tunnel dropped: ${detail}`);
    this.setStatus({ phase: "reconnecting", detail: trimDetail(detail) });
    this.retry.arm();
  }

  private settleFailure(status: RemoteErrorStatus, retryOnFailure: boolean): RemoteHostStatus {
    if (this.disposed) return this.currentStatus;
    if (!retryOnFailure) {
      this.setStatus(status);
      return this.currentStatus;
    }
    this.retry.arm();
    this.setStatus(
      this.retry.exhausted
        ? status
        : {
            phase: "reconnecting",
            detail: `${status.code}${status.detail === null ? "" : `: ${status.detail}`}`,
          },
    );
    return this.currentStatus;
  }

  /** Progress goes quiet once the failure has been named: flickering back through it would bury the cause. */
  private setProgress(status: RemoteHostStatus): void {
    if (this.retry.exhausted) return;
    this.setStatus(status);
  }

  private setStatus(status: RemoteHostStatus): void {
    this.currentStatus = status;
    this.options.onStatus(status);
  }
}
