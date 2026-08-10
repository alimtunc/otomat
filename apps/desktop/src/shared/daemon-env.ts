import { MAINTENANCE_ACTION_ENV, RESTORE_BACKUP_ENV } from "@otomat/domain";

import { DAEMON_HOST } from "#shared/constants";

export interface DaemonEnvOptions {
  port: number;
  /** SQLite file under the app's userData; its dirname becomes the daemon data dir (runs, worktrees). */
  dbPath: string;
  /** Git root the default project anchors to; a non-git dir just yields a project with no repo yet. */
  projectRoot: string;
  /** Resolved PATH so the daemon finds user CLIs even from a Finder launch. */
  path: string;
  /** Renderer origin to add to the daemon's CORS allowlist; omit in dev (loopback origins are auto-allowed). */
  allowedOrigin?: string;
  baseEnv?: NodeJS.ProcessEnv;
  /** Run the child as Node under the Electron binary (packaged app has no standalone node). */
  runAsNode?: boolean;
  /** Build the shell knows itself to be; an unstamped daemon bundle reports it from `/api/health`. */
  buildSha?: string;
}

export function buildDaemonEnv(options: DaemonEnvOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...options.baseEnv,
    PATH: options.path,
    OTOMAT_DAEMON_HOST: DAEMON_HOST,
    OTOMAT_DAEMON_PORT: String(options.port),
    OTOMAT_DB_PATH: options.dbPath,
    OTOMAT_PROJECT_ROOT: options.projectRoot,
  };
  delete env.OTOMAT_LINEAR_API_KEY;
  delete env[MAINTENANCE_ACTION_ENV];
  delete env[RESTORE_BACKUP_ENV];
  delete env.OTOMAT_WORKTREES_ROOT;
  delete env.OTOMAT_ALLOWED_ORIGINS;
  delete env.OTOMAT_BUILD_SHA;
  if (options.allowedOrigin !== undefined) env.OTOMAT_ALLOWED_ORIGINS = options.allowedOrigin;
  if (options.runAsNode === true) env.ELECTRON_RUN_AS_NODE = "1";
  if (options.buildSha !== undefined) env.OTOMAT_BUILD_SHA = options.buildSha;
  return env;
}
