import type { ProjectContract } from "./entities/workspace.js";

// The remote daemon stays loopback-bound on its host; the shell stores only the `~/.ssh/config` alias, never credentials.
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

export type RemoteHostPhase =
  | "disconnected"
  | "checking_host"
  | "starting_daemon"
  | "opening_tunnel"
  | "connected"
  | "reconnecting"
  | "error";

export type RemoteHostStatus =
  | { phase: Exclude<RemoteHostPhase, "error">; detail: string | null }
  | { phase: "error"; code: RemoteHostErrorCode; detail: string | null };

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
}

// Failures carry the structured remote status when one exists (the web catalog owns its wording) or contextual prose.
export type ExecutionHostOperationResult =
  | { ok: true }
  | { ok: false; status: RemoteHostStatus }
  | { ok: false; message: string };

export type ExecutionHostRegisterProjectResult =
  | { ok: true; project: ProjectContract }
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

/** One host's project catalog for the aggregated switcher; `projects` is null while the host's daemon is unreachable. */
export interface ExecutionHostProjectsEntry {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  projects: ProjectContract[] | null;
}
