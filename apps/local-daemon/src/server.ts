import { dirname, join } from "node:path";

import { serve } from "@hono/node-server";
import {
  createClient,
  DataSafetyError,
  defaultDbPath,
  inspectPathAfterFailure,
  prepareDatabase,
  readSchemaMetadata,
} from "@otomat/db";
import type { LinearLifecycleSync } from "@otomat/domain";

import { rescanSkills } from "#agents";
import { createApiApp, logApiRoutes } from "#api";
import { createRepositoryResolver } from "#git";
import {
  createGitHubCli,
  createGitHubService,
  createPullRequestGenerator,
  runCommand,
  type GitHubService,
} from "#github";
import {
  createLinearApiClient,
  createLinearService,
  createLinearTransport,
  takeLinearKeyFromEnv,
} from "#linear";
import { createReviewService } from "#review";
import {
  createReexecSpawn,
  createSupervisor,
  startWorkspaceReconciliation,
  type Supervisor,
} from "#supervisor";

import { ensureDefaultProject, ensureDefaultRepository } from "./bootstrap.js";
import {
  DAEMON_NAME,
  DAEMON_VERSION,
  daemonBuild,
  type CloseOptions,
  type DaemonHandle,
  type StartDaemonOptions,
} from "./server-contract.js";

export { DAEMON_NAME, DAEMON_VERSION } from "./server-contract.js";
export type { CloseOptions, DaemonHandle, StartDaemonOptions } from "./server-contract.js";

/** Slow enough to stay a maintenance pass rather than a poller, short enough that a merge is noticed within a work break. */
const WORKSPACE_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

function daemonStartupCleanupFailure(operation: unknown, cleanup: unknown): Error {
  return new Error("Daemon startup failed and its SQLite handle could not be closed.", {
    cause: new AggregateError(
      [operation, cleanup],
      "Daemon startup and SQLite cleanup both failed.",
    ),
  });
}

/** The daemon is the single writer: it migrates, bootstraps the project, reconciles crashed runs, then owns the supervisor. */
export async function startDaemon(options: StartDaemonOptions = {}): Promise<DaemonHandle> {
  const developmentLinearKey = takeLinearKeyFromEnv();
  const dbPath = options.dbPath ?? defaultDbPath();
  await prepareDatabase(dbPath);
  let preparedClient: ReturnType<typeof createClient>;
  try {
    preparedClient = createClient(dbPath, { fileMustExist: true });
  } catch (error) {
    const inspection = inspectPathAfterFailure(dbPath, error);
    if (inspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before daemon startup.",
        { cause: inspection.cause },
      );
    }
    throw inspection.cause;
  }
  const { db, sqlite } = preparedClient;

  try {
    const dataDir = dirname(dbPath);
    const projectRoot = process.env.OTOMAT_PROJECT_ROOT ?? process.cwd();
    const defaultProjectId = ensureDefaultProject(db, projectRoot);
    ensureDefaultRepository(db, defaultProjectId);
    try {
      rescanSkills(db);
    } catch (error) {
      console.error("[otomat] skill discovery failed at boot", error);
    }
    const repositories = createRepositoryResolver({
      db,
      worktreesRoot: process.env.OTOMAT_WORKTREES_ROOT ?? join(dataDir, "worktrees"),
    });
    // Review needs the supervisor's append capability while the supervisor needs review's
    // settle hook; the same late binding `state.advance` uses inside the supervisor.
    let appendStepTarget: Supervisor | null = null;
    let publishCommentTarget: GitHubService | null = null;
    const review = createReviewService({
      db,
      dataDir,
      repositories,
      appendRunStep: (runId, input) => {
        if (appendStepTarget === null) {
          return Promise.reject(new Error("review fix requested before the supervisor started"));
        }
        return appendStepTarget.appendStep(runId, input);
      },
      publishReviewComment: (runId, input) => {
        if (publishCommentTarget === null) {
          return Promise.reject(new Error("comment publication requested before GitHub started"));
        }
        return publishCommentTarget.publishReviewComment(runId, input);
      },
    });
    const linear = createLinearService({
      db,
      dataDir,
      client: createLinearApiClient(createLinearTransport()),
    });
    if (developmentLinearKey !== null) {
      void linear.connect(developmentLinearKey).catch((error: unknown) => {
        console.error("[otomat] Linear development connection failed", error);
      });
    }
    const syncIssueLifecycle: LinearLifecycleSync = (signal) => {
      void linear.syncIssueLifecycle(signal).catch((error: unknown) => {
        console.error(`[otomat] Linear lifecycle sync for issue ${signal.issue_id} failed`, error);
      });
    };
    const github = createGitHubService({
      db,
      dataDir,
      repositories,
      cli: createGitHubCli(runCommand),
      generator: createPullRequestGenerator(runCommand),
      syncIssueLifecycle,
    });
    publishCommentTarget = github;

    const mainScript = process.argv[1];
    if (!mainScript) throw new Error("cannot determine daemon entrypoint for worker re-exec");
    const supervisor = createSupervisor({
      db,
      dataDir,
      defaultProjectId,
      spawn: createReexecSpawn(mainScript),
      repositories,
      afterSettle: review.onRunSettled,
      syncIssueLifecycle,
      refreshPullRequests: () => github.refreshTrackedPullRequests(),
    });
    appendStepTarget = supervisor;

    const report = supervisor.reconcile();
    if (report.reconciled.length > 0) {
      console.log(`[otomat] reconciled ${report.reconciled.length} run(s) left in flight at boot`);
    }
    const workspacePasses = startWorkspaceReconciliation(async () => {
      await supervisor.reconcileWorkspaces();
    }, WORKSPACE_RECONCILE_INTERVAL_MS);

    const app = createApiApp({
      db,
      name: DAEMON_NAME,
      version: DAEMON_VERSION,
      build: daemonBuild(),
      startedAt: new Date().toISOString(),
      dbPath,
      schemaMetadata: () => readSchemaMetadata(sqlite),
      supervisor,
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
      const failures: unknown[] = [];
      workspacePasses.stop();
      if (closeOptions.terminateInFlightMs !== undefined) {
        try {
          await supervisor.shutdown(closeOptions.terminateInFlightMs);
        } catch (error) {
          failures.push(error);
        }
      }
      await new Promise<void>((resolve) => {
        try {
          server.close((closeError) => {
            if (closeError) failures.push(closeError);
            resolve();
          });
        } catch (error) {
          failures.push(error);
          resolve();
        }
      });
      try {
        await supervisor.settle();
      } catch (error) {
        failures.push(error);
      }
      try {
        sqlite.close();
      } catch (error) {
        failures.push(error);
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) {
        throw new AggregateError(failures, "Daemon shutdown encountered multiple failures.");
      }
    }

    return { port: listening.port, close };
  } catch (error) {
    try {
      sqlite.close();
    } catch (closeError) {
      throw daemonStartupCleanupFailure(error, closeError);
    }
    throw error;
  }
}
