// Remote shell the preview provisioner runs over one ssh round trip. Every outcome is a single
// OTOMAT_PREVIEW: token so a login shell's own noise can never be read as a result.

export const TOKEN_PREFIX = "OTOMAT_PREVIEW:";

/** Line the operator puts in ~/.cloudflared/config.yml; everything above it is theirs, everything below is generated. */
export const INGRESS_MARKER = "# --- otomat preview ingress (generated) ---";

const INSTANCES_ROOT = '"$HOME/.otomat/instances"';

/**
 * Rebuilds the tunnel's ingress from the route descriptor each instance owns, so adding or
 * removing one pull request never has to edit a shared list in place. Serialized with flock:
 * two pull requests can be provisioned at the same moment.
 */
function ingressRebuild() {
  return [
    'CONFIG="$HOME/.cloudflared/config.yml"',
    'if [ ! -f "$CONFIG" ]; then',
    `  echo "${TOKEN_PREFIX}NO_TUNNEL_CONFIG:$CONFIG"`,
    "  exit 0",
    "fi",
    `if ! grep -qF "${INGRESS_MARKER}" "$CONFIG"; then`,
    `  echo "${TOKEN_PREFIX}NO_INGRESS_MARKER:$CONFIG"`,
    "  exit 0",
    "fi",
    'mkdir -p "$HOME/.otomat"',
    'LOCK="$HOME/.otomat/ingress.lock"',
    'exec 9>"$LOCK"',
    "flock 9",
    'NEXT="$(mktemp)"',
    `sed "/^${INGRESS_MARKER}\\$/,\\$d" "$CONFIG" > "$NEXT"`,
    `echo "${INGRESS_MARKER}" >> "$NEXT"`,
    'echo "ingress:" >> "$NEXT"',
    `for route in ${INSTANCES_ROOT}/*/instance.route; do`,
    '  [ -f "$route" ] || continue',
    '  read -r ROUTE_HOST ROUTE_PORT _ < "$route" || continue',
    '  [ -n "$ROUTE_HOST" ] && [ -n "$ROUTE_PORT" ] || continue',
    '  printf "  - hostname: %s\\n" "$ROUTE_HOST" >> "$NEXT"',
    '  printf "    service: http://127.0.0.1:%s\\n" "$ROUTE_PORT" >> "$NEXT"',
    '  printf "    originRequest:\\n      httpHostHeader: 127.0.0.1:%s\\n" "$ROUTE_PORT" >> "$NEXT"',
    "done",
    'printf "  - service: http_status:404\\n" >> "$NEXT"',
    'mv "$NEXT" "$CONFIG"',
    // cloudflared watches its config file; the signal only makes the reload immediate.
    "pkill -HUP -x cloudflared 2>/dev/null || true",
  ];
}

function startOrVerify(homeSuffix, port) {
  return [
    `HOME_DIR="$HOME/${homeSuffix}"`,
    'ENTRY="$HOME_DIR/daemon/dist/index.js"',
    'PID_FILE="$HOME_DIR/daemon.pid"',
    'PID="$(cat "$PID_FILE" 2>/dev/null || true)"',
    'if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && grep -aqF "$ENTRY" "/proc/$PID/cmdline" 2>/dev/null; then',
    `  echo "${TOKEN_PREFIX}RUNNING:$PID"`,
    "else",
    "  if ! command -v node >/dev/null 2>&1; then",
    `    echo "${TOKEN_PREFIX}NO_NODE:-"`,
    "    exit 0",
    "  fi",
    `  OTOMAT_DAEMON_HOST=127.0.0.1 OTOMAT_DAEMON_PORT=${String(port)} \\`,
    '    OTOMAT_DB_PATH="$HOME_DIR/data/otomat.db" \\',
    '    OTOMAT_PROJECT_ROOT="$HOME_DIR/data/test-repo" \\',
    '    nohup node "$ENTRY" >> "$HOME_DIR/daemon.log" 2>&1 < /dev/null &',
    '  DAEMON_PID="$!"',
    "  sleep 2",
    '  if ! kill -0 "$DAEMON_PID" 2>/dev/null; then',
    `    echo "${TOKEN_PREFIX}START_FAILED:$(tail -c 200 "$HOME_DIR/daemon.log" | tr '\\n' ' ')"`,
    "    exit 0",
    "  fi",
    '  echo "$DAEMON_PID" > "$PID_FILE"',
    `  echo "${TOKEN_PREFIX}STARTED:$DAEMON_PID"`,
    "fi",
  ];
}

/**
 * Idempotent by construction: an instance that already carries this commit's bundle, its fixture
 * repository and a live daemon is left exactly as it is, and only its route is re-derived.
 * `OTOMAT_ALLOWED_ORIGINS` is deliberately unset — the façade forwards no `Origin`, and the tunnel
 * rewrites `Host` to loopback, so the daemon's own guards keep rejecting everything else.
 */
export function provisionScript(options) {
  return [
    "set -u",
    `HOME_DIR="$HOME/${options.homeSuffix}"`,
    'mkdir -p "$HOME_DIR/data"',
    'if [ ! -f "$HOME_DIR/daemon/dist/index.js" ]; then',
    '  if [ ! -f "$HOME_DIR/daemon.tar.gz" ]; then',
    `    echo "${TOKEN_PREFIX}NO_BUNDLE:$HOME_DIR/daemon.tar.gz"`,
    "    exit 0",
    "  fi",
    '  rm -rf "$HOME_DIR/daemon.next"',
    '  mkdir -p "$HOME_DIR/daemon.next"',
    '  if ! tar -xzf "$HOME_DIR/daemon.tar.gz" -C "$HOME_DIR/daemon.next" 2>/dev/null; then',
    `    echo "${TOKEN_PREFIX}EXTRACT_FAILED:$HOME_DIR/daemon.tar.gz"`,
    "    exit 0",
    "  fi",
    '  mv "$HOME_DIR/daemon.next/daemon" "$HOME_DIR/daemon"',
    '  rm -rf "$HOME_DIR/daemon.next" "$HOME_DIR/daemon.tar.gz"',
    "fi",
    'if [ ! -d "$HOME_DIR/data/test-repo/.git" ]; then',
    '  mkdir -p "$HOME_DIR/data/test-repo"',
    '  git -C "$HOME_DIR/data/test-repo" init -q -b main',
    '  printf "# Preview fixture\\n" > "$HOME_DIR/data/test-repo/README.md"',
    '  git -C "$HOME_DIR/data/test-repo" add README.md',
    '  git -C "$HOME_DIR/data/test-repo" -c user.name=Otomat -c user.email=preview@otomat.local commit -q -m "chore: seed the preview fixture"',
    "fi",
    `printf '%s %s %s\\n' "${options.hostname}" "${String(options.port)}" "${String(options.pullRequest)}" > "$HOME_DIR/instance.route"`,
    ...startOrVerify(options.homeSuffix, options.port),
    ...ingressRebuild(),
    `echo "${TOKEN_PREFIX}READY:${options.hostname}"`,
    "",
  ].join("\n");
}

/** Stops by verified pidfile pid, drops the instance's data, then re-derives the ingress without it. */
export function teardownScript(options) {
  return [
    "set -u",
    `HOME_DIR="$HOME/${options.homeSuffix}"`,
    'PID="$(cat "$HOME_DIR/daemon.pid" 2>/dev/null || true)"',
    'if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && grep -aqF "$HOME_DIR/" "/proc/$PID/cmdline" 2>/dev/null; then',
    '  kill "$PID" 2>/dev/null',
    "  for _ in 1 2 3 4 5 6 7 8 9 10; do",
    '    kill -0 "$PID" 2>/dev/null || break',
    "    sleep 1",
    "  done",
    '  kill -9 "$PID" 2>/dev/null',
    "fi",
    'rm -rf "$HOME_DIR"',
    ...ingressRebuild(),
    `echo "${TOKEN_PREFIX}TORN_DOWN:${options.homeSuffix}"`,
    "",
  ].join("\n");
}

/** One line per provisioned instance, so a caller can tell which pull requests still hold one. */
export function listScript() {
  return [
    "set -u",
    `for route in ${INSTANCES_ROOT}/*/instance.route; do`,
    '  [ -f "$route" ] || continue',
    '  read -r ROUTE_HOST ROUTE_PORT ROUTE_PR _ < "$route" || continue',
    `  printf '${TOKEN_PREFIX}INSTANCE:%s:%s:%s:%s\\n' "$(basename "$(dirname "$route")")" "$ROUTE_PR" "$ROUTE_HOST" "$ROUTE_PORT"`,
    "done",
    `echo "${TOKEN_PREFIX}END:-"`,
    "",
  ].join("\n");
}

/** Null when the END token is missing — a truncated listing must never read as "no instances". */
export function parseInstances(stdout) {
  const lines = stdout.split(/\r?\n/);
  if (!lines.some((line) => line.startsWith(`${TOKEN_PREFIX}END:`))) return null;
  const instances = [];
  for (const line of lines) {
    if (!line.startsWith(`${TOKEN_PREFIX}INSTANCE:`)) continue;
    const [build, pullRequest, hostname, port] = line
      .slice(`${TOKEN_PREFIX}INSTANCE:`.length)
      .split(":");
    if (!build || !pullRequest || !hostname || !port) continue;
    instances.push({
      build,
      pullRequest: Number.parseInt(pullRequest, 10),
      hostname,
      port: Number.parseInt(port, 10),
    });
  }
  return instances;
}

/** Last token wins; null means the script reported nothing at all. */
export function parseOutcome(stdout) {
  const tokens = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith(TOKEN_PREFIX))
    .map((line) => line.slice(TOKEN_PREFIX.length));
  const last = tokens.at(-1);
  if (last === undefined) return null;
  const separator = last.indexOf(":");
  return separator === -1
    ? { kind: last, detail: "" }
    : { kind: last.slice(0, separator), detail: last.slice(separator + 1) };
}
