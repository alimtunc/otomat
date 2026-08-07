import { MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import type { RemoteDeployment } from "../bootstrap/scripts.js";
import { lastToken } from "../ssh/tokens.js";

const BACKUP_PREFIX = "OTOMAT_BACKUP:";
const ROLLBACK_PREFIX = "OTOMAT_ROLLBACK:";
const PRESENCE_PREFIX = "OTOMAT_PRESENCE:";

/**
 * Whether a deployment holds a daemon at all. It starts, stops and reads nothing else: the answer
 * only decides whether an update is a first install or an upgrade of something already running.
 */
export function daemonPresenceScript(deployment: RemoteDeployment): string {
  return [
    "set -u",
    `if [ -f "$HOME/${deployment.homeSuffix}/daemon/dist/index.js" ]; then`,
    `  echo "${PRESENCE_PREFIX}PRESENT:-"`,
    "else",
    `  echo "${PRESENCE_PREFIX}ABSENT:-"`,
    "fi",
    "",
  ].join("\n");
}

/** Null means the script never reported — never read as "absent", which would license an install. */
export function parseDaemonPresence(stdout: string): "present" | "absent" | null {
  const token = lastToken(stdout, PRESENCE_PREFIX);
  if (token === null) return null;
  if (token.kind === "PRESENT") return "present";
  return token.kind === "ABSENT" ? "absent" : null;
}

/**
 * Copies the database of a deployment whose data outlives its build, into a timestamped directory
 * beside it. Run only after the daemon is stopped, so the copy is consistent; `-wal` and `-shm` come
 * along because a daemon that was killed rather than asked can leave a tail in them. Nothing is
 * pruned here: this copy is the restore path when the new daemon turns out not to boot.
 */
export function backupDatabaseScript(deployment: RemoteDeployment): string {
  return [
    "set -u",
    `OTOMAT_HOME="$HOME/${deployment.homeSuffix}"`,
    'DB="$OTOMAT_HOME/data/otomat.db"',
    'if [ ! -f "$DB" ]; then',
    `  echo "${BACKUP_PREFIX}NO_DATABASE:-"`,
    "  exit 0",
    "fi",
    `DEST="$OTOMAT_HOME/${MANAGED_BACKUPS_DIRECTORY_NAME}/upgrade-$(date -u +%Y%m%dT%H%M%SZ)"`,
    'if ! ERR="$(mkdir -p "$DEST" 2>&1)"; then',
    `  echo "${BACKUP_PREFIX}FAILED:$(printf '%s' "$ERR" | tr '\\n' ' ' | cut -c1-160)"`,
    "  exit 0",
    "fi",
    'for FILE in "$DB" "$DB-wal" "$DB-shm"; do',
    '  [ -f "$FILE" ] || continue',
    '  if ! ERR="$(cp -p "$FILE" "$DEST/" 2>&1)"; then',
    `    echo "${BACKUP_PREFIX}FAILED:$(printf '%s' "$ERR" | tr '\\n' ' ' | cut -c1-160)"`,
    "    exit 0",
    "  fi",
    "done",
    // The copy has to survive a crash between here and the swap that follows it.
    "sync",
    `echo "${BACKUP_PREFIX}BACKED_UP:$DEST"`,
    "",
  ].join("\n");
}

export type BackupOutcome =
  | { kind: "backed_up"; path: string }
  | { kind: "no_database" }
  | { kind: "failed"; detail: string };

/** Last `OTOMAT_BACKUP:` token wins; null means the script never reported. */
export function parseBackupOutput(stdout: string): BackupOutcome | null {
  const token = lastToken(stdout, BACKUP_PREFIX);
  if (token === null) return null;
  switch (token.kind) {
    case "BACKED_UP":
      return token.detail === "" ? null : { kind: "backed_up", path: token.detail };
    case "NO_DATABASE":
      return { kind: "no_database" };
    case "FAILED":
      return { kind: "failed", detail: token.detail.trim() };
    default:
      return null;
  }
}

/**
 * Puts the bundle the deploy displaced back in place, so a daemon that does not boot is one ssh
 * round trip from the one that did. The bundle that failed is kept as `daemon.failed` for a support
 * bundle to explain; the next deploy clears both.
 */
export function rollbackDaemonScript(deployment: RemoteDeployment): string {
  return [
    "set -u",
    `OTOMAT_HOME="$HOME/${deployment.homeSuffix}"`,
    'if [ ! -d "$OTOMAT_HOME/daemon.prev" ]; then',
    `  echo "${ROLLBACK_PREFIX}NO_PREVIOUS:-"`,
    "  exit 0",
    "fi",
    'rm -rf "$OTOMAT_HOME/daemon.failed"',
    'if [ -d "$OTOMAT_HOME/daemon" ]; then mv "$OTOMAT_HOME/daemon" "$OTOMAT_HOME/daemon.failed"; fi',
    'if ! ERR="$(mv "$OTOMAT_HOME/daemon.prev" "$OTOMAT_HOME/daemon" 2>&1)"; then',
    // The failed bundle goes back rather than leaving the deployment with no daemon at all.
    '  if [ -d "$OTOMAT_HOME/daemon.failed" ]; then mv "$OTOMAT_HOME/daemon.failed" "$OTOMAT_HOME/daemon"; fi',
    `  echo "${ROLLBACK_PREFIX}FAILED:$(printf '%s' "$ERR" | tr '\\n' ' ' | cut -c1-160)"`,
    "  exit 0",
    "fi",
    `echo "${ROLLBACK_PREFIX}RESTORED:-"`,
    "",
  ].join("\n");
}

export type RollbackOutcome =
  | { kind: "restored" }
  | { kind: "no_previous" }
  | { kind: "failed"; detail: string };

/** Last `OTOMAT_ROLLBACK:` token wins; null means the script never reported. */
export function parseRollbackOutput(stdout: string): RollbackOutcome | null {
  const token = lastToken(stdout, ROLLBACK_PREFIX);
  if (token === null) return null;
  switch (token.kind) {
    case "RESTORED":
      return { kind: "restored" };
    case "NO_PREVIOUS":
      return { kind: "no_previous" };
    case "FAILED":
      return { kind: "failed", detail: token.detail.trim() };
    default:
      return null;
  }
}
