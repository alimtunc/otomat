/**
 * Daemon process entry point. Environment selects one of three modes in order:
 * one-shot restore maintenance, a re-exec'd supervised worker, or the HTTP
 * daemon. Only the HTTP mode migrates, bootstraps, reconciles crashed runs, and
 * binds a server; it is skipped under `VITEST`.
 * Public entry: `startDaemon` (re-exported from `./server.js`).
 *
 * @packageDocumentation
 */
import { defaultDbPath } from "@otomat/db";
import {
  MAINTENANCE_ACTION_ENV,
  MAINTENANCE_RESTORE_ACTION,
  RESTORE_BACKUP_ENV,
} from "@otomat/domain";

import { formatStartupDiagnostic, runRestoreMaintenance } from "#data-safety";
import { runWorkerMain } from "#supervisor";

import { DAEMON_NAME, DAEMON_VERSION, startDaemon, type DaemonHandle } from "./server.js";

export { startDaemon } from "./server.js";
export type { DaemonHandle, StartDaemonOptions } from "./server.js";
export { ensureDefaultProject, DEFAULT_PROJECT_ID } from "./bootstrap.js";

export function describeFoundation(): string {
  return `[otomat] ${DAEMON_NAME} ${DAEMON_VERSION} — db ${defaultDbPath()}`;
}

/** Grace a shutdown gives live workers before SIGKILL, and the hard ceiling before the daemon force-exits. */
const SHUTDOWN_TERMINATE_GRACE_MS = 3000;
const SHUTDOWN_HARD_EXIT_MS = 8000;

/** Turn SIGTERM/SIGINT into a bounded graceful shutdown so a supervising parent (desktop app, `pnpm back`) never leaves orphaned workers. */
function installShutdownHandlers(handle: DaemonHandle): void {
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[otomat] received ${signal}, shutting down`);
    const hardExit = setTimeout(() => process.exit(1), SHUTDOWN_HARD_EXIT_MS);
    hardExit.unref();
    handle
      .close({ terminateInFlightMs: SHUTDOWN_TERMINATE_GRACE_MS })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("[otomat] shutdown failed", error);
        process.exit(1);
      });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

if (process.env[MAINTENANCE_ACTION_ENV] === MAINTENANCE_RESTORE_ACTION) {
  const backupPath = process.env[RESTORE_BACKUP_ENV];
  if (backupPath === undefined) {
    console.error(formatStartupDiagnostic(new Error("missing restore backup")));
    process.exitCode = 1;
  } else {
    void runRestoreMaintenance(defaultDbPath(), backupPath)
      .then((preservedPath) =>
        console.log(
          preservedPath === null
            ? "[otomat] database restored"
            : `[otomat] database restored; previous state kept at ${preservedPath}`,
        ),
      )
      .catch((error) => {
        console.error(formatStartupDiagnostic(error));
        process.exitCode = 1;
      });
  }
} else if (process.env.OTOMAT_WORKER_JOB) {
  // Re-exec'd by the supervisor to run a single session as its own process. Never starts the server.
  void runWorkerMain();
} else if (!process.env.VITEST) {
  void startDaemon()
    .then((handle) => {
      console.log(`${describeFoundation()} — listening on http://localhost:${handle.port}/api`);
      installShutdownHandlers(handle);
    })
    .catch((error) => {
      console.error(formatStartupDiagnostic(error));
      process.exit(1);
    });
}
