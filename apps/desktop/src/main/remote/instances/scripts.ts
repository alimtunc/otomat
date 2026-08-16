import type { RemoteDeployment } from "../bootstrap/scripts.js";
import { lastToken } from "../ssh/tokens.js";

const DEPLOY_PREFIX = "OTOMAT_DEPLOY:";
const INSTANCE_PREFIX = "OTOMAT_INSTANCE:";
const INSTANCES_END = "OTOMAT_INSTANCES_END:-";

export const GH_MISSING =
  "the host has no `gh` CLI; install and authenticate it to deploy from CI artifacts";

export function artifactName(build: string): string {
  return `otomat-daemon-${build}-linux-x64`;
}

export interface DeployDaemonScriptOptions {
  deployment: RemoteDeployment;
  /** sha7 the artifact is named after; the caller has validated it. */
  build: string;
  /** GitHub `owner/repo` whose CI publishes `otomat-daemon-<sha7>-linux-x64`. */
  repo: string;
}

/**
 * Downloads the CI daemon bundle with the host's own authenticated `gh` and swaps it into the
 * deployment's `daemon/` directory. Nothing is started: the stable app's idle restart — or an
 * instance's next start-or-verify — boots whatever this leaves behind.
 */
export function deployDaemonScript(options: DeployDaemonScriptOptions): string {
  const name = artifactName(options.build);
  return [
    "set -u",
    `OTOMAT_HOME="$HOME/${options.deployment.homeSuffix}"`,
    `NAME="${name}"`,
    "if ! command -v gh >/dev/null 2>&1; then",
    `  echo "${DEPLOY_PREFIX}NO_GH:-"`,
    "  exit 0",
    "fi",
    'TMP="$(mktemp -d)"',
    "trap 'rm -rf \"$TMP\"' EXIT",
    `if ! ID="$(gh api "repos/${options.repo}/actions/artifacts?name=$NAME&per_page=1" --jq '.artifacts[0].id' 2>"$TMP/err")"; then`,
    `  echo "${DEPLOY_PREFIX}DOWNLOAD_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'if [ -z "$ID" ] || [ "$ID" = "null" ]; then',
    `  echo "${DEPLOY_PREFIX}NOT_FOUND:$NAME"`,
    "  exit 0",
    "fi",
    `if ! gh api "repos/${options.repo}/actions/artifacts/$ID/zip" > "$TMP/artifact.zip" 2>"$TMP/err"; then`,
    `  echo "${DEPLOY_PREFIX}DOWNLOAD_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    // python3 -m zipfile instead of unzip: present on every supported host, unzip often is not.
    'if ! python3 -m zipfile -e "$TMP/artifact.zip" "$TMP/x" 2>"$TMP/err"; then',
    `  echo "${DEPLOY_PREFIX}EXTRACT_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'if ! tar -xzf "$TMP/x/$NAME.tar.gz" -C "$TMP/x" 2>"$TMP/err"; then',
    `  echo "${DEPLOY_PREFIX}EXTRACT_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'mkdir -p "$OTOMAT_HOME"',
    'rm -rf "$OTOMAT_HOME/daemon.next" "$OTOMAT_HOME/daemon.prev" "$OTOMAT_HOME/daemon.failed"',
    `if ! mv "$TMP/x/daemon" "$OTOMAT_HOME/daemon.next" 2>"$TMP/err"; then`,
    `  echo "${DEPLOY_PREFIX}EXTRACT_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    'if [ -d "$OTOMAT_HOME/daemon" ]; then mv "$OTOMAT_HOME/daemon" "$OTOMAT_HOME/daemon.prev"; fi',
    `if ! mv "$OTOMAT_HOME/daemon.next" "$OTOMAT_HOME/daemon" 2>"$TMP/err"; then`,
    '  if [ -d "$OTOMAT_HOME/daemon.prev" ]; then mv "$OTOMAT_HOME/daemon.prev" "$OTOMAT_HOME/daemon"; fi',
    `  echo "${DEPLOY_PREFIX}EXTRACT_FAILED:$(tail -c 160 "$TMP/err" | tr '\\n' ' ')"`,
    "  exit 0",
    "fi",
    `echo "${DEPLOY_PREFIX}DEPLOYED:${options.build}"`,
    "",
  ].join("\n");
}

export type DeployOutcome =
  | { kind: "deployed"; build: string }
  | { kind: "gh_missing" }
  | { kind: "artifact_not_found"; name: string }
  | { kind: "download_failed"; detail: string }
  | { kind: "extract_failed"; detail: string };

/** A deploy that did not happen, as a clause a caller can put in its own sentence. */
export function describeDeployFailure(
  outcome: Exclude<DeployOutcome, { kind: "deployed" }>,
): string {
  switch (outcome.kind) {
    case "gh_missing":
      return GH_MISSING;
    case "artifact_not_found":
      return `no CI artifact is named ${outcome.name} (artifacts expire after 7 days; re-run the workflow to rebuild it)`;
    case "download_failed":
      return `the artifact download failed on the host: ${outcome.detail}`;
    case "extract_failed":
      return `the artifact could not be extracted on the host: ${outcome.detail}`;
  }
}

/** Last `OTOMAT_DEPLOY:` token wins; null means the script never reported. */
export function parseDeployOutput(stdout: string): DeployOutcome | null {
  const token = lastToken(stdout, DEPLOY_PREFIX);
  if (token === null) return null;
  const { detail } = token;
  switch (token.kind) {
    case "DEPLOYED":
      return { kind: "deployed", build: detail };
    case "NO_GH":
      return { kind: "gh_missing" };
    case "NOT_FOUND":
      return { kind: "artifact_not_found", name: detail };
    case "DOWNLOAD_FAILED":
      return { kind: "download_failed", detail: detail.trim() };
    case "EXTRACT_FAILED":
      return { kind: "extract_failed", detail: detail.trim() };
    default:
      return null;
  }
}

/** One line per instance directory; the END token proves the listing ran to completion. */
export function listInstancesScript(): string {
  return [
    "set -u",
    'BASE="$HOME/.otomat/instances"',
    'if [ -d "$BASE" ]; then',
    '  for dir in "$BASE"/*/; do',
    '    [ -d "$dir" ] || continue',
    '    KEY="$(basename "$dir")"',
    '    PID="$(cat "$dir/daemon.pid" 2>/dev/null || true)"',
    "    RUNNING=no",
    '    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && grep -aqF "$dir" "/proc/$PID/cmdline" 2>/dev/null; then RUNNING=yes; fi',
    '    SIZE="$(du -sk "$dir" 2>/dev/null | cut -f1)"',
    `    echo "${INSTANCE_PREFIX}\${KEY}:\${RUNNING}:\${SIZE:-0}"`,
    "  done",
    "fi",
    `echo "${INSTANCES_END}"`,
    "",
  ].join("\n");
}

export interface RemoteInstanceRow {
  build: string;
  running: boolean;
  sizeKb: number;
}

/** Null when the END token is missing — a truncated listing must never read as "no instances". */
export function parseInstanceList(stdout: string): RemoteInstanceRow[] | null {
  const lines = stdout.split(/\r?\n/);
  if (!lines.some((line) => line.startsWith(INSTANCES_END))) return null;
  const rows: RemoteInstanceRow[] = [];
  for (const line of lines) {
    if (!line.startsWith(INSTANCE_PREFIX)) continue;
    const [build, running, size] = line.slice(INSTANCE_PREFIX.length).split(":");
    if (build === undefined || build === "" || running === undefined) continue;
    rows.push({ build, running: running === "yes", sizeKb: Number.parseInt(size ?? "0", 10) || 0 });
  }
  return rows;
}

/** Stops the instance's daemon by verified pidfile pid, then removes its directory entirely. */
export function deleteInstanceScript(build: string): string {
  return [
    "set -u",
    `DIR="$HOME/.otomat/instances/${build}"`,
    'PID="$(cat "$DIR/daemon.pid" 2>/dev/null || true)"',
    'if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && grep -aqF "$DIR/" "/proc/$PID/cmdline" 2>/dev/null; then',
    '  kill "$PID" 2>/dev/null',
    "  for _ in 1 2 3 4 5 6 7 8 9 10; do",
    '    kill -0 "$PID" 2>/dev/null || break',
    "    sleep 1",
    "  done",
    '  kill -9 "$PID" 2>/dev/null',
    "fi",
    'rm -rf "$DIR"',
    `echo "OTOMAT_INSTANCE_DELETED:${build}"`,
    "",
  ].join("\n");
}
