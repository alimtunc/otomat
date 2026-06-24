import type { Db } from "@otomat/db";
import type { RunContract, StartRunRequest } from "@otomat/domain";

/** Identifies the supervisor as the event source so its markers are never shown as a provider result. */
export const SUPERVISOR_ADAPTER = "otomat-supervisor";

/** Env var carrying the serialized job to a re-exec'd worker process. */
export const WORKER_JOB_ENV = "OTOMAT_WORKER_JOB";

/** A turn the supervisor hands to a child process: a fresh run, or a follow-up that resumes a provider session. */
export interface SupervisedJob {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
  prompt: string;
  runDir: string;
  mode: "run" | "resume";
  providerSessionId: string | null;
}

/** How a child process ended, as observed by its parent. */
export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

/**
 * Handle to a spawned session process. `pgid` is the process-group id used for
 * group-wide signalling; for a detached child it equals `pid`. `exited` resolves
 * once the child is gone (never rejects).
 */
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
}

export interface Supervisor {
  /** Create the run/step/session rows, then spawn and track the session process. Returns once it is running. */
  start(request: StartRunRequest): Promise<RunContract>;
  /** Resume a human-waiting run on an explicit action — spawns a `resume` turn, never auto-runs. */
  resume(runId: string): Promise<RunContract>;
  /** Kill the run's process group and write the canonical canceled state + a ledger event. No fake success. */
  abort(runId: string, reason?: string): Promise<void>;
  /** Boot-time pass: classify every non-terminal in-flight run from durable evidence and settle it. */
  reconcile(): Promise<ReconcileReport>;
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

/**
 * Non-terminal states a crash must NOT disturb: review_ready awaits review and
 * awaiting_human awaits an explicit resume. Every other non-terminal run (queued,
 * preparing, running, awaiting_permission) is an in-flight remnant the boot pass
 * settles — so a run parked in `queued` on the concurrency semaphore is reconciled,
 * not left as a phantom.
 */
export const RESTING_RUN_STATES = ["review_ready", "awaiting_human"] as const;
