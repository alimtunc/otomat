import { defaultDbPath } from "@otomat/db";

import { DAEMON_NAME, DAEMON_VERSION, startDaemon } from "./server.js";

export { startDaemon } from "./server.js";
export type { DaemonHandle, StartDaemonOptions } from "./server.js";
export { createRunLauncher } from "./launcher.js";
export { ensureDefaultProject, DEFAULT_PROJECT_ID } from "./bootstrap.js";

export function describeFoundation(): string {
  return `[otomat] ${DAEMON_NAME} ${DAEMON_VERSION} — db ${defaultDbPath()}`;
}

if (!process.env.VITEST) {
  const handle = startDaemon();
  console.log(`${describeFoundation()} — listening on http://localhost:${handle.port}/api`);
}
