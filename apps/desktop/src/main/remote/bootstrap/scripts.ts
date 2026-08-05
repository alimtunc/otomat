/** Where a daemon lives on the host — a path under `$HOME` — and the loopback port it binds. */
export interface RemoteDeployment {
  homeSuffix: string;
  port: number;
}

/** The stable app's daemon: the conventions documented in docs/ai/remote-execution-host.md. */
export const STABLE_DEPLOYMENT: RemoteDeployment = { homeSuffix: ".otomat", port: 4319 };

const INSTANCE_PORT_BASE = 43100;
const INSTANCE_PORT_SPAN = 900;

/**
 * A preview build's own isolated daemon on the host, keyed by the build it expects: data,
 * pidfile and port all disjoint from the stable deployment, so testing an artifact never
 * touches the daemon real work runs on. An unidentifiable build shares one "unknown" slot
 * rather than ever falling back to the stable deployment.
 */
export function instanceDeployment(build: string | null): RemoteDeployment {
  const key = build !== null && /^[0-9a-f]{7}$/.test(build) ? build : "unknown";
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % INSTANCE_PORT_SPAN;
  return { homeSuffix: `.otomat/instances/${key}`, port: INSTANCE_PORT_BASE + hash };
}

const TOKEN_PREFIX = "OTOMAT_REMOTE:";

// Host conventions live in docs/ai/remote-execution-host.md; every outcome is a single OTOMAT_REMOTE: token so login-shell noise never breaks parsing.
export function startOrVerifyDaemonScript(deployment: RemoteDeployment): string {
  return [
    "set -u",
    `OTOMAT_HOME="$HOME/${deployment.homeSuffix}"`,
    'ENTRY="$OTOMAT_HOME/daemon/dist/index.js"',
    'PID_FILE="$OTOMAT_HOME/daemon.pid"',
    'mkdir -p "$OTOMAT_HOME/data"',
    'PID="$(cat "$PID_FILE" 2>/dev/null || true)"',
    // The pid must still be the daemon: after a reboot or crash the pidfile can name a recycled pid, which would otherwise block the restart forever.
    'if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && grep -aqF "$ENTRY" "/proc/$PID/cmdline" 2>/dev/null; then',
    `  echo "${TOKEN_PREFIX}RUNNING:$PID"`,
    "  exit 0",
    "fi",
    'if [ ! -f "$ENTRY" ]; then',
    `  echo "${TOKEN_PREFIX}NO_DAEMON:$ENTRY"`,
    "  exit 0",
    "fi",
    "if ! command -v node >/dev/null 2>&1; then",
    `  echo "${TOKEN_PREFIX}NO_NODE:-"`,
    "  exit 0",
    "fi",
    'NODE_MAJOR="$(node -p \'process.versions.node.split(".")[0]\')"',
    'if [ "$NODE_MAJOR" -lt 22 ]; then',
    `  echo "${TOKEN_PREFIX}NODE_TOO_OLD:$(node --version)"`,
    "  exit 0",
    "fi",
    `OTOMAT_DAEMON_HOST=127.0.0.1 OTOMAT_DAEMON_PORT=${deployment.port} \\`,
    '  OTOMAT_DB_PATH="$OTOMAT_HOME/data/otomat.db" \\',
    '  OTOMAT_PROJECT_ROOT="$OTOMAT_HOME/data" \\',
    "  OTOMAT_ALLOWED_ORIGINS=otomat://app \\",
    '  nohup node "$ENTRY" >> "$OTOMAT_HOME/daemon.log" 2>&1 < /dev/null &',
    'DAEMON_PID="$!"',
    "sleep 2",
    'if ! kill -0 "$DAEMON_PID" 2>/dev/null; then',
    `  echo "${TOKEN_PREFIX}START_FAILED:$(tail -c 200 "$OTOMAT_HOME/daemon.log" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'echo "$DAEMON_PID" > "$PID_FILE"',
    `echo "${TOKEN_PREFIX}STARTED:$DAEMON_PID"`,
    "",
  ].join("\n");
}

/**
 * Stops the pidfile-tracked daemon (SIGTERM, bounded wait, then SIGKILL) so the
 * next start-or-verify boots whatever the deploy directory now holds. Kills by
 * pid, never by pattern, so the remote shell can never match itself — and only
 * after the pid's cmdline proves it is still the daemon, never a recycled pid.
 */
export function stopDaemonScript(deployment: RemoteDeployment): string {
  return [
    "set -u",
    `OTOMAT_HOME="$HOME/${deployment.homeSuffix}"`,
    'PID_FILE="$OTOMAT_HOME/daemon.pid"',
    'if [ -f "$PID_FILE" ]; then',
    '  PID="$(cat "$PID_FILE")"',
    '  if kill -0 "$PID" 2>/dev/null && grep -aqF "$OTOMAT_HOME/daemon/dist/index.js" "/proc/$PID/cmdline" 2>/dev/null; then',
    '    kill "$PID" 2>/dev/null',
    "    for _ in 1 2 3 4 5 6 7 8 9 10; do",
    '      kill -0 "$PID" 2>/dev/null || break',
    "      sleep 1",
    "    done",
    '    kill -9 "$PID" 2>/dev/null',
    "  fi",
    '  rm -f "$PID_FILE"',
    "fi",
    `echo "${TOKEN_PREFIX}STOPPED:-"`,
    "",
  ].join("\n");
}

export type RemoteBootstrapOutcome =
  | { kind: "running"; pid: number }
  | { kind: "started"; pid: number }
  | { kind: "start_failed"; logTail: string }
  | { kind: "daemon_missing"; entry: string }
  | { kind: "node_missing" }
  | { kind: "node_too_old"; version: string };

function liveDaemon(kind: "running" | "started", detail: string): RemoteBootstrapOutcome | null {
  const pid = Number.parseInt(detail, 10);
  return Number.isInteger(pid) && pid > 0 ? { kind, pid } : null;
}

/** Last `OTOMAT_REMOTE:` token wins; null means the script never reported (treated as a start failure). */
export function parseBootstrapOutput(stdout: string): RemoteBootstrapOutcome | null {
  const token = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(TOKEN_PREFIX))
    .at(-1)
    ?.slice(TOKEN_PREFIX.length);
  const separator = token?.indexOf(":") ?? -1;
  if (token === undefined || separator === -1) return null;
  const detail = token.slice(separator + 1);
  switch (token.slice(0, separator)) {
    case "RUNNING":
      return liveDaemon("running", detail);
    case "STARTED":
      return liveDaemon("started", detail);
    case "START_FAILED":
      return { kind: "start_failed", logTail: detail.trim() };
    case "NO_DAEMON":
      return { kind: "daemon_missing", entry: detail };
    case "NO_NODE":
      return { kind: "node_missing" };
    case "NODE_TOO_OLD":
      return { kind: "node_too_old", version: detail };
    default:
      return null;
  }
}
