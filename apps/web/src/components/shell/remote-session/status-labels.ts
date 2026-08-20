import type {
  ExecutionHostOperationResult,
  RemoteHostErrorCode,
  RemoteHostPhase,
  RemoteHostStatus,
} from "@otomat/domain";
import type { RemoteSessionState } from "@web/components/shell/remote-session/context";

const REMOTE_PHASE_LABELS = {
  disconnected: "Disconnected",
  checking_host: "Connecting over SSH…",
  starting_daemon: "Starting the remote daemon…",
  opening_tunnel: "Opening the SSH tunnel…",
  checking_version: "Checking the daemon version…",
  waiting_for_runs: "Update waiting for the host to go idle…",
  waiting_for_artifact: "Waiting for the CI artifact…",
  installing_update: "Installing the daemon update…",
  verifying_update: "Restarting and verifying the daemon…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  error: "Connection failed",
} satisfies Record<RemoteHostPhase, string>;

const REMOTE_ERROR_MESSAGES = {
  not_configured: "Configure the SSH alias first.",
  ssh_unreachable:
    "The host could not be reached over SSH. Check that connecting with `ssh` works from a terminal (keys, agent, host key already accepted).",
  daemon_missing:
    "The Otomat daemon is not installed on the host — expected at ~/.otomat/daemon/dist/index.js.",
  node_missing: "Node.js 22+ was not found on the host's login shell PATH.",
  node_too_old: "The host's Node.js is older than version 22.",
  daemon_start_failed: "The remote daemon did not start. Check ~/.otomat/daemon.log on the host.",
  tunnel_failed: "The SSH tunnel closed unexpectedly.",
  health_failed: "The remote daemon never answered its health check through the tunnel.",
  switch_in_progress: "A host switch is already in progress.",
  local_daemon_unavailable: "The local daemon is not running.",
} satisfies Record<RemoteHostErrorCode, string>;

/** The compact progress line a shell shows while the host settles; the alias names where it is going. */
export function remoteStatusHeadline(status: RemoteHostStatus, alias: string | null): string {
  if (status.phase === "checking_host" && alias !== null) return `Connecting to ${alias}…`;
  if (status.phase === "waiting_for_runs" && status.active_runs > 0) {
    const runs = status.active_runs === 1 ? "1 run" : `${status.active_runs} runs`;
    return `Update waiting on ${runs}…`;
  }
  return REMOTE_PHASE_LABELS[status.phase];
}

/** The same status at full length: what failed, and whatever the host said about it. */
export function describeRemoteStatus(status: RemoteHostStatus): string {
  const base =
    status.phase === "error"
      ? REMOTE_ERROR_MESSAGES[status.code]
      : remoteStatusHeadline(status, null);
  return status.detail === null ? base : `${base} — ${status.detail}`;
}

/** A refused host operation as one sentence, whether it answered with a coded status or its own prose. */
export function describeOperationFailure(
  result: Extract<ExecutionHostOperationResult, { ok: false }>,
): string {
  return "status" in result ? describeRemoteStatus(result.status) : result.message;
}

/** A configured alias only names the answering host while that host is the active one. */
export function executionHostLabel(session: RemoteSessionState): string {
  return session.active && session.alias !== null ? session.alias : "the local host";
}
