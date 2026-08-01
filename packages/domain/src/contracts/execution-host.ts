/**
 * Execution-host contracts for the desktop shell: which daemon the cockpit talks
 * to (the locally spawned one, or a user-owned remote host reached over an SSH
 * tunnel) and the honest lifecycle states of that remote connection. The remote
 * daemon stays loopback-bound on its host; the shell only ever stores the
 * `~/.ssh/config` alias name, never credentials.
 */
export type ExecutionHostId = "local" | "remote";

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

export type ExecutionHostOperationResult = { ok: true } | { ok: false; message: string };
