import { dirname } from "node:path";

import { serve } from "@hono/node-server";
import { createApiApp, logApiRoutes } from "@otomat/api";
import { createClient, defaultDbPath, runMigrations } from "@otomat/db";

import { ensureDefaultProject } from "./bootstrap.js";
import { createRunLauncher } from "./launcher.js";

export const DAEMON_NAME = "otomat-local-daemon";
export const DAEMON_VERSION = "0.1.0";

export interface StartDaemonOptions {
  port?: number;
  dbPath?: string;
}

export interface DaemonHandle {
  port: number;
  close(): Promise<void>;
}

/** The daemon is the single writer: it migrates, bootstraps the project, and owns the runtime/ledger composition. */
export function startDaemon(options: StartDaemonOptions = {}): DaemonHandle {
  const dbPath = options.dbPath ?? defaultDbPath();
  runMigrations(dbPath);
  const { db, sqlite } = createClient(dbPath);

  const dataDir = dirname(dbPath);
  const projectRoot = process.env.OTOMAT_PROJECT_ROOT ?? process.cwd();
  const defaultProjectId = ensureDefaultProject(db, projectRoot);
  const launcher = createRunLauncher({ db, dataDir, defaultProjectId });

  const app = createApiApp({
    db,
    name: DAEMON_NAME,
    version: DAEMON_VERSION,
    startedAt: new Date().toISOString(),
    dbPath,
    launchRun: launcher.launchRun,
  });

  if (process.env.OTOMAT_LOG_ROUTES) logApiRoutes(app);

  const port = options.port ?? Number(process.env.OTOMAT_DAEMON_PORT ?? 4319);
  const server = serve({ fetch: app.fetch, port });
  server.on("error", (error) => {
    console.error(`[otomat] daemon failed to bind port ${port}`, error);
    process.exit(1);
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((closeError) => {
          void launcher.settle().finally(() => {
            sqlite.close();
            if (closeError) reject(closeError);
            else resolve();
          });
        });
      }),
  };
}
