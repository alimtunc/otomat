import type { Db, RunRow } from "@otomat/db";
import type { StartRunRequest } from "@otomat/domain";

import type { RepositoryResolver } from "#git";
import type { KnownRuntimeId } from "#runtime";

/** Identifies the supervisor as the event source so its markers are never shown as a provider result. */
export const SUPERVISOR_ADAPTER = "otomat-supervisor";

/** Env var carrying the serialized job to a re-exec'd worker process. */
export const WORKER_JOB_ENV = "OTOMAT_WORKER_JOB";

/** The run/step/session ids, prompt, and artifact dir a single turn drives. */
export interface TurnContext {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
  prompt: string;
  runDir: string;
  /** Isolated working dir the turn mutates; null when the project has no git repository. */
  worktreePath: string | null;
  /** Runtime adapter id the worker instantiates; persisted on the run via its agent row. */
  runtime: KnownRuntimeId;
}

/** A turn the supervisor hands to a child process: a fresh run, or a follow-up that resumes a provider session. */
export interface SupervisedJob extends TurnContext {
  mode: "run" | "resume";
  providerSessionId: string | null;
}

/** How a child process ended, as observed by its parent. */
export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

/** `pgid` equals `pid` for a detached child; `exited` resolves once the child is gone and never rejects. */
export interface SessionProcess {
  pid: number;
  pgid: number;
  exited: Promise<ProcessExit>;
  kill(signal: NodeJS.Signals): void;
}

/** Spawns one job as a real OS process. Injected so the supervisor stays testable without the daemon binary. */
export type SpawnSession = (job: SupervisedJob) => SessionProcess;

export interface SupervisorConfig {
  db: Db;
  /** Root under which each run gets a `runs/<id>/events.jsonl` artifact directory. */
  dataDir: string;
  defaultProjectId: string;
  spawn: SpawnSession;
  /** Max concurrent session processes. Defaults to {@link DEFAULT_CONCURRENCY}. */
  concurrency?: number;
  /** A project without a usable repository yields runs with no worktree or diff. */
  repositories: RepositoryResolver;
  /** Fires after any settle (live, abort, boot) so review anchors/diff projections can react. */
  afterSettle?: (outcome: ReconcileOutcome) => void;
}

export interface Supervisor {
  /** Create the run/step/session rows, then spawn and track the session process. Returns once it is running. */
  start(request: StartRunRequest): Promise<RunRow>;
  /** Resume a human-waiting run on an explicit action — spawns a `resume` turn, never auto-runs. */
  resume(runId: string): Promise<RunRow>;
  /** Spawn a follow-up fix turn on a review-ready run with a caller-built prompt. */
  fix(runId: string, prompt: string): Promise<RunRow>;
  /** Resume a resting run (`awaiting_human` or `review_ready`) with the user's own follow-up prompt. */
  followUp(runId: string, prompt: string): Promise<RunRow>;
  /** Kill the run's process group and write the canonical canceled state + a ledger event. No fake success. */
  abort(runId: string): Promise<void>;
  /** Boot-time pass: classify every non-terminal in-flight run from durable evidence and settle it. */
  reconcile(): ReconcileReport;
  /** Resolve once every in-flight session process has exited (shutdown/test aid). */
  settle(): Promise<void>;
}

/** Outcome of classifying one crashed/aborted run against the durable ledger + process liveness. */
export type ReconcileClassification = "completed" | "interrupted" | "failed" | "canceled";

export interface ReconcileOutcome {
  runId: string;
  classification: ReconcileClassification;
  reason: string;
  /** A still-running orphan process was found and its group was terminated. */
  orphanTerminated: boolean;
  providerSessionId: string | null;
}

export interface ReconcileReport {
  reconciled: ReconcileOutcome[];
}

export const DEFAULT_CONCURRENCY = 4;
