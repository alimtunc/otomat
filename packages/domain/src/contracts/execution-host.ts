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
}

// Failures carry the structured remote status when one exists (the web catalog owns its wording) or contextual prose.
export type ExecutionHostOperationResult =
  | { ok: true }
  | { ok: false; status: RemoteHostStatus }
  | { ok: false; message: string };
