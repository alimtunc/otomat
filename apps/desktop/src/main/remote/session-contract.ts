import type { RemoteHostStatus } from "@otomat/domain";

import type { DaemonCredential } from "#shared/daemon-credentials";
import type { waitForHealth } from "#shared/health";
import type { findFreeLoopbackPort } from "#shared/ports";

import type { RemoteDeployment } from "./bootstrap/scripts.js";
import type { runSshScript } from "./ssh/script.js";
import type { SshTunnelOptions, TunnelHandle } from "./ssh/tunnel.js";

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
  /** Null until connected, or for a host daemon from before bearers. */
  readonly credential: DaemonCredential | null;
  readonly remoteBuild: string | null;
  ensureLocalPort(): Promise<number>;
  connect(retryOnFailure: boolean): Promise<RemoteHostStatus>;
  refreshDaemon(): Promise<RemoteHostStatus>;
  dispose(): Promise<void>;
}
