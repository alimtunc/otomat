import type { RemoteHostErrorCode, RemoteHostPhase, RemoteHostStatus } from "@otomat/domain";

const REMOTE_PHASE_LABELS: Record<RemoteHostPhase, string> = {
  disconnected: "Disconnected",
  checking_host: "Checking host over SSH…",
  starting_daemon: "Starting the remote daemon…",
  opening_tunnel: "Opening the SSH tunnel…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  error: "Connection failed",
};

const REMOTE_ERROR_MESSAGES: Record<RemoteHostErrorCode, string> = {
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
};

export function describeRemoteStatus(status: RemoteHostStatus): string {
  const base =
    status.phase === "error"
      ? REMOTE_ERROR_MESSAGES[status.code]
      : REMOTE_PHASE_LABELS[status.phase];
  return status.detail === null ? base : `${base} — ${status.detail}`;
}
