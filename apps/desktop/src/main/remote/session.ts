import type { RemoteHostStatus } from "@otomat/domain";

import { waitForHealth } from "#shared/health";
import { findFreeLoopbackPort } from "#shared/ports";

import {
  resolveBootstrapResult,
  trimDetail,
  type BootstrapResolution,
  type RemoteErrorStatus,
} from "./bootstrap-status.js";
import { REMOTE_DAEMON_PORT, startOrVerifyDaemonScript } from "./daemon-bootstrap.js";
import { runSshScript } from "./ssh.js";
import { SshTunnel, type SshTunnelOptions, type TunnelHandle } from "./tunnel.js";

const BOOTSTRAP_TIMEOUT_MS = 30_000;
const TUNNEL_HEALTH_TIMEOUT_MS = 15_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 15_000];

export interface RemoteSessionOptions {
  alias: string;
  log(message: string): void;
  onStatus(status: RemoteHostStatus): void;
  runScript?: typeof runSshScript;
  createTunnel?: (options: SshTunnelOptions) => TunnelHandle;
  health?: typeof waitForHealth;
  reservePort?: typeof findFreeLoopbackPort;
  scheduleRetry?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
}

export interface RemoteSessionHandle {
  readonly alias: string;
  readonly status: RemoteHostStatus;
  readonly url: string | null;
  ensureLocalPort(): Promise<number>;
  connect(retryOnFailure: boolean): Promise<RemoteHostStatus>;
  dispose(): Promise<void>;
}

// `connected` is declared only after a health response came back through the tunnel; the remote daemon is never stopped from here — durability is the point.
export class RemoteHostSession implements RemoteSessionHandle {
  private currentStatus: RemoteHostStatus = { phase: "disconnected", detail: null };
  private localPort: number | null = null;
  private tunnel: TunnelHandle | null = null;
  private disposed = false;
  private inFlight: Promise<RemoteHostStatus> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;

  constructor(private readonly options: RemoteSessionOptions) {}

  get alias(): string {
    return this.options.alias;
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
    this.cancelRetry();
    this.inFlight = this.attempt(retryOnFailure).finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.cancelRetry();
    const tunnel = this.tunnel;
    this.tunnel = null;
    if (tunnel !== null) await tunnel.stop();
    this.setStatus({ phase: "disconnected", detail: null });
  }

  private async attempt(retryOnFailure: boolean): Promise<RemoteHostStatus> {
    try {
      const localPort = await this.ensureLocalPort();
      const bootstrap = await this.bootstrapDaemon();
      if ("failure" in bootstrap) return this.settleFailure(bootstrap.failure, retryOnFailure);
      const tunnelFailure = await this.openTunnel(localPort);
      if (tunnelFailure !== null) return this.settleFailure(tunnelFailure, retryOnFailure);
      this.retryAttempt = 0;
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
    this.setStatus({ phase: "checking_host", detail: `ssh ${this.options.alias}` });
    const run = this.options.runScript ?? runSshScript;
    const result = await run({
      alias: this.options.alias,
      script: startOrVerifyDaemonScript(),
      timeoutMs: BOOTSTRAP_TIMEOUT_MS,
    });
    const resolution = resolveBootstrapResult(result);
    if ("failure" in resolution) return resolution;
    this.setStatus({ phase: "starting_daemon", detail: resolution.detail });
    return resolution;
  }

  private async openTunnel(localPort: number): Promise<RemoteErrorStatus | null> {
    this.setStatus({ phase: "opening_tunnel", detail: `127.0.0.1:${localPort}` });
    const abort = new AbortController();
    let exitDetail: string | null = null;
    const createTunnel =
      this.options.createTunnel ?? ((options: SshTunnelOptions) => new SshTunnel(options));
    const tunnel = createTunnel({
      alias: this.options.alias,
      localPort,
      remotePort: REMOTE_DAEMON_PORT,
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
      await (this.options.health ?? waitForHealth)({
        url: `http://127.0.0.1:${localPort}/api/health`,
        timeoutMs: TUNNEL_HEALTH_TIMEOUT_MS,
        signal: abort.signal,
      });
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

  private onTunnelDropped(detail: string): void {
    this.tunnel = null;
    if (this.currentStatus.phase !== "connected") return;
    this.options.log(`Remote tunnel dropped: ${detail}`);
    this.setStatus({ phase: "reconnecting", detail: trimDetail(detail) });
    this.scheduleRetry();
  }

  private settleFailure(status: RemoteErrorStatus, retryOnFailure: boolean): RemoteHostStatus {
    if (this.disposed) return this.currentStatus;
    if (retryOnFailure) {
      this.setStatus({
        phase: "reconnecting",
        detail: `${status.code}${status.detail === null ? "" : `: ${status.detail}`}`,
      });
      this.scheduleRetry();
      return this.currentStatus;
    }
    this.setStatus(status);
    return this.currentStatus;
  }

  private scheduleRetry(): void {
    if (this.disposed || this.retryTimer !== null) return;
    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.retryAttempt, RECONNECT_DELAYS_MS.length - 1)] ??
      RECONNECT_DELAYS_MS[0] ??
      1_000;
    this.retryAttempt += 1;
    const schedule = this.options.scheduleRetry ?? ((callback, ms) => setTimeout(callback, ms));
    this.retryTimer = schedule(() => {
      this.retryTimer = null;
      void this.connect(true);
    }, delay);
  }

  private cancelRetry(): void {
    if (this.retryTimer === null) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setStatus(status: RemoteHostStatus): void {
    this.currentStatus = status;
    this.options.onStatus(status);
  }
}
