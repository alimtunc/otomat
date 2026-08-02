export const REMOTE_DAEMON_PORT = 4319;

const TOKEN_PREFIX = "OTOMAT_REMOTE:";

// Host conventions live in docs/ai/remote-execution-host.md; every outcome is a single OTOMAT_REMOTE: token so login-shell noise never breaks parsing.
export function startOrVerifyDaemonScript(): string {
  return [
    "set -u",
    'OTOMAT_HOME="$HOME/.otomat"',
    'ENTRY="$OTOMAT_HOME/daemon/dist/index.js"',
    'PID_FILE="$OTOMAT_HOME/daemon.pid"',
    'mkdir -p "$OTOMAT_HOME/data"',
    'if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then',
    `  echo "${TOKEN_PREFIX}RUNNING:$(cat "$PID_FILE")"`,
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
    `OTOMAT_DAEMON_HOST=127.0.0.1 OTOMAT_DAEMON_PORT=${REMOTE_DAEMON_PORT} \\`,
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
 * pid, never by pattern, so the remote shell can never match itself.
 */
export function stopDaemonScript(): string {
  return [
    "set -u",
    'OTOMAT_HOME="$HOME/.otomat"',
    'PID_FILE="$OTOMAT_HOME/daemon.pid"',
    'if [ -f "$PID_FILE" ]; then',
    '  PID="$(cat "$PID_FILE")"',
    '  if kill -0 "$PID" 2>/dev/null; then',
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

/** Last `OTOMAT_REMOTE:` token wins; null means the script never reported (treated as a start failure). */
export function parseBootstrapOutput(stdout: string): RemoteBootstrapOutcome | null {
  const tokenLine = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(TOKEN_PREFIX))
    .at(-1);
  if (tokenLine === undefined) return null;
  const rest = tokenLine.slice(TOKEN_PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator === -1) return null;
  const kind = rest.slice(0, separator);
  const detail = rest.slice(separator + 1);
  if (kind === "RUNNING" || kind === "STARTED") {
    const pid = Number.parseInt(detail, 10);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    return { kind: kind === "RUNNING" ? "running" : "started", pid };
  }
  if (kind === "START_FAILED") return { kind: "start_failed", logTail: detail.trim() };
  if (kind === "NO_DAEMON") return { kind: "daemon_missing", entry: detail };
  if (kind === "NO_NODE") return { kind: "node_missing" };
  if (kind === "NODE_TOO_OLD") return { kind: "node_too_old", version: detail };
  return null;
}
