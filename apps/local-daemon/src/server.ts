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
import { LINEAR_DEFAULT_CONNECTION_ID, type LinearLifecycleSync } from "@otomat/domain";

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
import { createReexecSpawn, createSupervisor, type Supervisor } from "#supervisor";

import { ensureDefaultProject, ensureDefaultRepository } from "./bootstrap.js";
import { lateBinding } from "./late-binding.js";
import { startMaintenancePasses } from "./maintenance.js";
import {
  DAEMON_NAME,
  DAEMON_VERSION,
  daemonBuild,
  type DaemonHandle,
  type StartDaemonOptions,
} from "./server-contract.js";
import { createDaemonClose } from "./shutdown.js";

export { DAEMON_NAME, DAEMON_VERSION } from "./server-contract.js";
export type { CloseOptions, DaemonHandle, StartDaemonOptions } from "./server-contract.js";

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
    const supervisorBinding = lateBinding<Supervisor>("the supervisor");
    const gitHubBinding = lateBinding<GitHubService>("GitHub");
    const review = createReviewService({
      db,
      dataDir,
      repositories,
      appendRunStep: (runId, input) => supervisorBinding.on((it) => it.appendStep(runId, input)),
      submitPullRequestReview: (pullRequestId, input) =>
        gitHubBinding.on((it) => it.submitPullRequestReview(pullRequestId, input)),
      syncViewedFile: (pullRequestId, input) =>
        gitHubBinding.on((it) => it.syncViewedFile(pullRequestId, input)),
      readViewedFiles: (pullRequestId) =>
        gitHubBinding.on((it) => it.readViewedFiles(pullRequestId)),
    });
    const linear = createLinearService({
      db,
      dataDir,
      client: createLinearApiClient(createLinearTransport()),
    });
    if (developmentLinearKey !== null) {
      void linear
        .connect({
          id: LINEAR_DEFAULT_CONNECTION_ID,
          label: "Linear",
          api_key: developmentLinearKey,
        })
        .catch((error: unknown) => {
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
      importViewedFiles: (pullRequestId) => {
        void review.importViewedFiles(pullRequestId).catch((error: unknown) => {
          console.error(`[otomat] viewed state import for ${pullRequestId} failed`, error);
        });
      },
    });
    gitHubBinding.bind(github);

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
    supervisorBinding.bind(supervisor);

    const report = supervisor.reconcile();
    if (report.reconciled.length > 0) {
      console.log(`[otomat] reconciled ${report.reconciled.length} run(s) left in flight at boot`);
    }
    const interrupted = github.reconcileInterruptedPublications();
    if (interrupted > 0) {
      console.log(
        `[otomat] ${interrupted} GitHub publication(s) were interrupted; retry reconciles them`,
      );
    }
    const maintenance = startMaintenancePasses(supervisor);

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

    const close = createDaemonClose({
      stopMaintenancePasses: () => maintenance.stop(),
      supervisor,
      server,
      settlePublications: () => github.settlePublications(),
      closeDatabase: () => sqlite.close(),
    });

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
