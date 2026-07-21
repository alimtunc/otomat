import { DAEMON_HOST } from "#shared/constants";

export interface DaemonEnvOptions {
  port: number;
  /** SQLite file under the app's userData; its dirname becomes the daemon data dir (runs, worktrees). */
  dbPath: string;
  /** Git root the default project anchors to; a non-git dir just yields a project with no repo yet. */
  projectRoot: string;
  /** Resolved PATH so the daemon finds user CLIs even from a Finder launch. */
  path: string;
  /** Renderer origin to add to the daemon's CORS allowlist (packaged app scheme); omit in dev (loopback origins are auto-allowed). */
  allowedOrigin?: string;
  /** Env to extend — the app's own env, so the daemon keeps HOME etc. */
  baseEnv?: NodeJS.ProcessEnv;
  /** Run the child as Node under the Electron binary (packaged app has no standalone node). */
  runAsNode?: boolean;
}

/** Builds the environment for the spawned daemon child from the shell-managed knobs the daemon already reads. */
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
  if (options.allowedOrigin !== undefined) env.OTOMAT_ALLOWED_ORIGINS = options.allowedOrigin;
  if (options.runAsNode === true) env.ELECTRON_RUN_AS_NODE = "1";
  return env;
}
