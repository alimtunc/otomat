import type { Db, RunContributionRow, RunInteractionRow, RunRow, StepRunRow } from "@otomat/db";
import type {
  AgentCapacity,
  ContextReference,
  ContextReviewComment,
  ContextSelection,
  ExecutionOverrides,
  LaunchHold,
  LinearLifecycleSync,
  ProviderOptions,
  ResolvedAgentConfig,
  RunResumePlan,
  RuntimeInteractionAnswer,
  RunWait,
  StartRunRequest,
  WorkspaceCleanupResult,
  WorkspaceClosureFacts,
  WorkspaceInventory,
  WorkspaceReconcileReport,
} from "@otomat/domain";

import type { AgentConfigSelector } from "#agents";
import type { RepositoryResolver } from "#git";
import type { KnownRuntimeId } from "#runtime";

/** What asked for a plan revision; kept on the journaled event so the history reads honestly. */
export type PlanRevisionOrigin = "user" | "review_fix";

/** One append-only plan revision: a named step, an explicitly chosen agent, its declared context, and what it waits on. */
export interface AppendStepInput {
  name: string;
  note: string | null;
  references: readonly ContextReference[];
  /** Review comments this step was asked to address, already frozen with their anchors. */
  reviewComments?: readonly ContextReviewComment[];
  /** The agent the user picked for this step; never inherited from the last session. */
  selector: AgentConfigSelector;
  overrides: ExecutionOverrides;
  dependsOn: readonly string[];
  replaces: string | null;
  origin: PlanRevisionOrigin;
}

/** Identifies the supervisor as the event source so its markers are never shown as a provider result. */
export const SUPERVISOR_ADAPTER = "otomat-supervisor";

export interface TurnContext {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
  /** The instruction this turn adds to its dossier: a recovery brief, a native continuation, or a legacy run's frozen prompt. `null` when the dossier and the carried batch are the whole turn. */
  prompt: string | null;
  /** What the plan froze for this step; a fresh session materializes its dossier from it. */
  contextSelection: ContextSelection | null;
  /** Evidence dir of the agent session, reused by every turn of that session. */
  agentSessionDir: string;
  /** Isolated working dir the turn mutates. Always present: a run that cannot own one is refused at launch. */
  worktreePath: string;
  runtime: KnownRuntimeId;
  /** Repository init commands to run in `worktreePath` before the provider spawns. Compete candidates only: the run's canonical worktree is initialized at launch. */
  worktreeInit?: { commands: string[]; label: string };
  /** Frozen for this step; null on runs launched before profiles existed. */
  config: ResolvedAgentConfig | null;
  carryContributionIds?: readonly string[];
}

/** A job is a turn whose prompt is already composed — context included — so the worker never has to ask what to run. */
export interface SupervisedJob extends Omit<
  TurnContext,
  "prompt" | "contextSelection" | "carryContributionIds"
> {
  prompt: string;
  mode: "run" | "resume";
  providerSessionId: string | null;
}

export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

/** `pgid` equals `pid` for a detached child; `exited` resolves once the child is gone and never rejects. */
export interface SessionProcess {
  pid: number;
  pgid: number;
  exited: Promise<ProcessExit>;
  /** Releases the worker after the parent has durably recorded its process identity. */
  start(): void;
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
  /** Resolves the repository a run forks its worktree from; a project without one cannot be launched on. */
  repositories: RepositoryResolver;
  /** Fires after any settle (live, abort, boot) so review anchors/diff projections can react. */
  afterSettle?: (outcome: ReconcileOutcome) => void;
  /** Mirrors a durably created run onto the linked tracker issue; omitted leaves the daemon tracker-silent. */
  syncIssueLifecycle?: LinearLifecycleSync;
  /** Injected so `#supervisor` never imports `#github`; answers how many rows were refreshed. */
  refreshPullRequests?: () => Promise<number>;
}

export interface WorkspaceScope {
  runId?: string;
  projectId?: string;
}

export interface Supervisor {
  /** Create the run/step/session rows and return once they are durable; the first step claims its slot in the background. */
  start(request: StartRunRequest): Promise<RunRow>;
  /** Why a run is not progressing right now — this host's session cap, or a plan dependency — or null while it is. */
  waitFor(runId: string): RunWait | null;
  /** This host's session cap and what it is doing with it right now. */
  capacity(): AgentCapacity;
  /** Persist and apply a new cap: raising it drains the queue at once, lowering it only gates the next start. */
  setCapacity(maxConcurrentSessions: number): AgentCapacity;
  setLaunchHold(held: boolean): LaunchHold;
  setNextTurnModel(
    runId: string,
    stepRunId: string,
    sessionId: string,
    currentConfigHash: string,
    model: string,
    options: ProviderOptions,
  ): StepRunRow;
  /** Interrupt the step's live turn without settling the run or starting dependents; the step lands `awaiting_human`, resumable on the same provider session. */
  stopStep(runId: string, stepRunId: string): Promise<StepRunRow>;
  /** Resume a resting or stopped run on an explicit action — never auto-runs. */
  resume(runId: string): Promise<RunRow>;
  /** What that resume would do, so the cockpit shows native reattachment or a recovery session before it runs. */
  resumePlan(runId: string): RunResumePlan;
  scheduleProviderResume(runId: string, resumeAt: string | null): void;
  /** Scheduler pass: resume every suspended step whose deadline has come. Answers how many runs it resumed. */
  resumeDueProviderWaits(): Promise<number>;
  /** Close the issue's work cycle by hand; refused while a turn is live, and it deletes nothing in git. */
  abandon(runId: string): RunRow;
  /** The branch, commits, uncommitted work and diff an abandon would leave behind; null for an unknown run. */
  workspaceClosure(runId: string): WorkspaceClosureFacts | null;
  /** Append one step to the run's plan and start it once the workspace is free; refused once the workspace closes. */
  appendStep(runId: string, input: AppendStepInput): Promise<RunRow>;
  /** Persist one user message on an explicitly selected step as `queued`, then deliver it if that step can take it now. */
  contribute(
    runId: string,
    stepRunId: string,
    targetAgentSessionId: string | null,
    targetConfigHash: string,
    body: string,
  ): Promise<RunContributionRow>;
  /** Re-queue a failed message that never reached the provider and retry the run's queue. */
  retryContribution(runId: string, contributionId: string): Promise<RunContributionRow>;
  /** Withdraw a message no turn has claimed yet; it stays in the conversation as `canceled`. */
  cancelContribution(runId: string, contributionId: string): RunContributionRow;
  /** Explicit "deliver now" for messages left queued by a restart; a no-op while the run is busy. */
  deliverContributions(runId: string): Promise<void>;
  /** Answer one question a live turn is blocked on; repeating the same answer settles nothing twice. */
  answerInteraction(
    runId: string,
    interactionId: string,
    answer: RuntimeInteractionAnswer,
  ): Promise<RunInteractionRow>;
  /** Reserve, promote and archive one succeeded competitor, then unlock dependent work. */
  selectWinner(runId: string, groupId: string, stepRunId: string): Promise<void>;
  /** Kill the run's process group and write the canonical canceled state + a ledger event. No fake success. */
  abort(runId: string): Promise<void>;
  /** Boot-time pass: classify every non-terminal in-flight run from durable evidence and settle it. */
  reconcile(): ReconcileReport;
  /** A read: it prunes and deletes nothing. */
  workspaces(scope?: WorkspaceScope): WorkspaceInventory;
  /** Concurrent callers share the one running pass. */
  reconcileWorkspaces(): Promise<WorkspaceReconcileReport>;
  /** `null` for a worktree no record holds. */
  cleanupWorkspace(worktreeId: string): WorkspaceCleanupResult | null;
  /** Resolve once every in-flight session process has exited (shutdown/test aid). */
  settle(): Promise<void>;
  /** Stop every in-flight worker group (SIGTERM, then SIGKILL after `graceMs`); resolves once all have exited. */
  shutdown(graceMs: number): Promise<void>;
}

export type ReconcileClassification =
  | "completed"
  | "interrupted"
  | "provider_limited"
  | "failed"
  | "canceled";

export interface ReconcileOutcome {
  runId: string;
  /** The turn this settle converged; null when the settle read the whole ledger instead of one turn. */
  stepRunId: string | null;
  agentSessionId: string | null;
  classification: ReconcileClassification;
  reason: string;
  /** A still-running orphan process was found and its group was terminated. */
  orphanTerminated: boolean;
  providerSessionId: string | null;
}

export interface ReconcileReport {
  reconciled: ReconcileOutcome[];
}
