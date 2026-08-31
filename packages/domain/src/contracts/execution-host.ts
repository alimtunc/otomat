import type { AgentCapacity } from "./capacity.js";
import type { ProjectContract, RepositoryContract } from "./entities/workspace.js";

export const EXECUTION_HOST_IDS = ["local", "remote"] as const;

export type ExecutionHostId = (typeof EXECUTION_HOST_IDS)[number];

export function isExecutionHostId(value: unknown): value is ExecutionHostId {
  return EXECUTION_HOST_IDS.some((id) => id === value);
}

export type RemoteHostErrorCode =
  | "not_configured"
  | "ssh_unreachable"
  | "daemon_missing"
  | "node_missing"
  | "node_too_old"
  | "daemon_start_failed"
  | "tunnel_failed"
  | "health_failed"
  | "switch_in_progress"
  | "local_daemon_unavailable";

/**
 * One remote host journey, from the first ssh round trip to a daemon running the build this app
 * expects. The update phases belong to the same machine as the connection ones because installing a
 * daemon stops and restarts the tunnel: split in two, a normal upgrade would read as a lost host.
 */
export type RemoteHostPhase =
  | "disconnected"
  | "checking_host"
  | "starting_daemon"
  | "opening_tunnel"
  | "checking_version"
  | "waiting_for_runs"
  | "waiting_for_artifact"
  | "installing_update"
  | "verifying_update"
  | "connected"
  | "reconnecting"
  | "error";

export type RemoteHostStatus =
  | { phase: Exclude<RemoteHostPhase, "error" | "waiting_for_runs">; detail: string | null }
  | { phase: "waiting_for_runs"; active_runs: number; detail: string | null }
  | { phase: "error"; code: RemoteHostErrorCode; detail: string | null };

const SETTLING_PHASES: RemoteHostPhase[] = [
  "checking_host",
  "starting_daemon",
  "opening_tunnel",
  "checking_version",
  "installing_update",
  "verifying_update",
  "reconnecting",
];

/**
 * Whether the host is mid-journey: expected progress, never a failure. Every surface that would
 * otherwise report a dead daemon — the offline banner, a query boundary with no data yet — reads
 * this, so a bootstrap that takes half a minute never renders as a terminal state.
 *
 * Every phase listed above is bounded by a timeout or a retry schedule. The two waits are left out:
 * the tunnel serves the cockpit throughout them, so holding every query on its pending slot for
 * minutes would hide real failures — they are reported where they are actionable instead.
 */
export function isRemoteHostSettling(status: RemoteHostStatus | null): boolean {
  return status !== null && SETTLING_PHASES.includes(status.phase);
}

/** Structural equality over the status union; a null `b` — nothing seen yet — never matches. */
export function sameRemoteHostStatus(a: RemoteHostStatus, b: RemoteHostStatus | null): boolean {
  if (b === null || a.phase !== b.phase || a.detail !== b.detail) return false;
  if (a.phase === "waiting_for_runs" && b.phase === "waiting_for_runs") {
    return a.active_runs === b.active_runs;
  }
  if (a.phase === "error" && b.phase === "error") return a.code === b.code;
  return true;
}

export interface ExecutionHostDescriptor {
  id: ExecutionHostId;
  label: string;
  kind: "local" | "ssh";
}

export interface ExecutionHostSnapshot {
  hosts: ExecutionHostDescriptor[];
  active_id: ExecutionHostId;
  remote_ssh_alias: string | null;
  remote_status: RemoteHostStatus | null;
  /** Build the remote daemon reported on its last healthy connect; null before one or when unstamped. */
  remote_build: string | null;
  /** Build this app expects on every host (packaged commit or dev checkout HEAD); null when unidentifiable. */
  expected_build: string | null;
  /** Why the last automatic daemon update stopped, when one did; the old daemon kept running. */
  remote_update_error: string | null;
}

export type ExecutionHostOperationResult =
  | { ok: true }
  | { ok: false; status: RemoteHostStatus }
  | { ok: false; message: string };

export type ExecutionHostRegisterProjectResult =
  | { ok: true; project: ProjectContract }
  | { ok: false; message: string };

/** One host's session capacity as its own daemon reports it; a host that could not answer carries the reason. */
export type ExecutionHostCapacityResult =
  | { ok: true; capacity: AgentCapacity }
  | { ok: false; message: string };

/** One preview daemon under `~/.otomat/instances/<build>` on the remote host. */
export interface RemoteInstanceEntry {
  build: string;
  running: boolean;
  size_kb: number;
  port: number;
}

export type RemoteInstanceListResult =
  | { ok: true; instances: RemoteInstanceEntry[] }
  | { ok: false; message: string };

/** One git repository found under the remote host's `$HOME`. */
export interface RemoteRepositoryEntry {
  /** Absolute path of the working tree on the host. */
  path: string;
  /** Path relative to the host's `$HOME`, for a listing that reads without the home prefix. */
  label: string;
}

export type RemoteRepositoryListResult =
  | { ok: true; repositories: RemoteRepositoryEntry[] }
  | { ok: false; message: string };

/** One host's project catalog for the aggregated switcher; `projects` is null while the host's daemon is unreachable. */
export interface ExecutionHostProjectsEntry {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  projects: ProjectContract[] | null;
}

/** One host's registered repositories; `repositories` is null while the host's daemon is unreachable, never an empty list. */
export interface ExecutionHostRepositoriesEntry {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  repositories: RepositoryContract[] | null;
}

export type ExecutionHostCallResult<T> = { ok: true; value: T } | { ok: false; message: string };
