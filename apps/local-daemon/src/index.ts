import { defaultDbPath } from "@otomat/db";

import { runWorkerMain } from "#supervisor";

import { DAEMON_NAME, DAEMON_VERSION, startDaemon } from "./server.js";

export { startDaemon } from "./server.js";
export type { DaemonHandle, StartDaemonOptions } from "./server.js";
export { ensureDefaultProject, DEFAULT_PROJECT_ID } from "./bootstrap.js";

export function describeFoundation(): string {
  return `[otomat] ${DAEMON_NAME} ${DAEMON_VERSION} — db ${defaultDbPath()}`;
}

if (process.env.OTOMAT_WORKER_JOB) {
  // Re-exec'd by the supervisor to run a single session as its own process. Never starts the server.
  void runWorkerMain();
} else if (!process.env.VITEST) {
  const handle = startDaemon();
  console.log(`${describeFoundation()} — listening on http://localhost:${handle.port}/api`);
}
