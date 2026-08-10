export const DAEMON_NAME = "otomat-local-daemon";
export const DAEMON_VERSION = "0.1.0";

// The dist bundle bakes the git commit in at build time (tsdown define); a
// source run reads the env the desktop shell injects, and reports null when
// neither is present.
export function daemonBuild(): string | null {
  const sha = process.env.OTOMAT_BUILD_SHA;
  return sha === undefined || sha === "" ? null : sha;
}

export interface StartDaemonOptions {
  port?: number;
  dbPath?: string;
}

export interface CloseOptions {
  /** SIGTERM then (after this many ms) SIGKILL every in-flight worker before settling, so shutdown never blocks on a live run. Omitted → wait for runs to settle themselves. */
  terminateInFlightMs?: number;
}

export interface DaemonHandle {
  port: number;
  /** Rejects with every shutdown failure preserved. */
  close(options?: CloseOptions): Promise<void>;
}
