import { dirname, join } from "node:path";

import { serve } from "@hono/node-server";
import { createClient, defaultDbPath, runMigrations } from "@otomat/db";

import { createApiApp, logApiRoutes } from "#api";
import { createRepositoryResolver } from "#git";
import { createGitHubCli, createGitHubService, runCommand } from "#github";
import {
  createLinearApiClient,
  createLinearService,
  createLinearTransport,
  takeLinearKeyFromEnv,
} from "#linear";
import { createReviewService } from "#review";
import { createReexecSpawn, createSupervisor } from "#supervisor";

import { ensureDefaultProject, ensureDefaultRepository } from "./bootstrap.js";

export const DAEMON_NAME = "otomat-local-daemon";
export const DAEMON_VERSION = "0.1.0";

export interface StartDaemonOptions {
  port?: number;
  dbPath?: string;
}

export interface CloseOptions {
  /** SIGTERM then (after this many ms) SIGKILL every in-flight worker before settling, so shutdown never blocks on a live run. Omitted → wait for runs to settle themselves. */
  terminateInFlightMs?: number;
}

export interface DaemonHandle {
  port: number;
  /** Stops accepting connections, then settles in-flight runs and closes the SQLite handle; resolves once all three finish, rejecting if the server itself fails to close. */
  close(options?: CloseOptions): Promise<void>;
}

/** The daemon is the single writer: it migrates, bootstraps the project, reconciles crashed runs, then owns the supervisor. */
export async function startDaemon(options: StartDaemonOptions = {}): Promise<DaemonHandle> {
  // Remove the key before supervised workers can inherit it.
  const developmentLinearKey = takeLinearKeyFromEnv();
  const dbPath = options.dbPath ?? defaultDbPath();
  runMigrations(dbPath);
  const { db, sqlite } = createClient(dbPath);

  const dataDir = dirname(dbPath);
  const projectRoot = process.env.OTOMAT_PROJECT_ROOT ?? process.cwd();
  const defaultProjectId = ensureDefaultProject(db, projectRoot);
  const defaultRepositoryId = ensureDefaultRepository(db, defaultProjectId, projectRoot);
  const repositories = createRepositoryResolver({
    db,
    worktreesRoot: process.env.OTOMAT_WORKTREES_ROOT ?? join(dataDir, "worktrees"),
    ...(defaultRepositoryId === null ? { unavailableProjectIds: new Set([defaultProjectId]) } : {}),
  });
  const review = createReviewService({ db, dataDir, repositories });
  const github = createGitHubService({
    db,
    dataDir,
    repositories,
    cli: createGitHubCli(runCommand),
  });
  const linear = createLinearService({
    db,
    client: createLinearApiClient(createLinearTransport()),
  });
  if (developmentLinearKey !== null) {
    void linear.connect(developmentLinearKey).catch((error: unknown) => {
      console.error("[otomat] Linear development connection failed", error);
    });
  }

  const mainScript = process.argv[1];
  if (!mainScript) throw new Error("cannot determine daemon entrypoint for worker re-exec");
  const supervisor = createSupervisor({
    db,
    dataDir,
    defaultProjectId,
    spawn: createReexecSpawn(mainScript),
    repositories,
    afterSettle: review.onRunSettled,
  });

  // Settle crash remnants before accepting traffic: no phantom "running" run, no double-spawn.
  const report = supervisor.reconcile();
  if (report.reconciled.length > 0) {
    console.log(`[otomat] reconciled ${report.reconciled.length} run(s) left in flight at boot`);
  }

  const app = createApiApp({
    db,
    name: DAEMON_NAME,
    version: DAEMON_VERSION,
    startedAt: new Date().toISOString(),
    dbPath,
    launchRun: supervisor.start,
    resumeRun: supervisor.resume,
    fixRun: supervisor.fix,
    followUpRun: supervisor.followUp,
    selectCompeteWinner: supervisor.selectWinner,
    abortRun: supervisor.abort,
    github,
    linear,
    review,
  });

  if (process.env.OTOMAT_LOG_ROUTES) logApiRoutes(app);

  const port = options.port ?? Number(process.env.OTOMAT_DAEMON_PORT ?? 4319);
  const hostname = process.env.OTOMAT_DAEMON_HOST ?? "127.0.0.1";
  const listening = await new Promise<{
    server: ReturnType<typeof serve>;
    port: number;
  }>((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname }, (address) => {
      server.off("error", reject);
      resolve({ server, port: address.port });
    });
    server.once("error", reject);
  });
  const { server } = listening;
  server.on("error", (error) => {
    console.error(`[otomat] daemon server failed on port ${listening.port}`, error);
    process.exit(1);
  });

  async function close(closeOptions: CloseOptions = {}): Promise<void> {
    if (closeOptions.terminateInFlightMs !== undefined) {
      await supervisor.shutdown(closeOptions.terminateInFlightMs);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((closeError) => {
        void supervisor.settle().finally(() => {
          sqlite.close();
          if (closeError) reject(closeError);
          else resolve();
        });
      });
    });
  }

  return { port: listening.port, close };
}
