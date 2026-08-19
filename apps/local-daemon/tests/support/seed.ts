import { join } from "node:path";

import { getRepository, listStepRunsForRun, schema, type Db } from "@otomat/db";
import type { AgentSessionState, RunState, StepProviderWait, StepRunState } from "@otomat/domain";

export interface SeedRunOptions {
  runId: string;
  issueId?: string;
  /** Omitted uses `repo-1` when the fixture seeded it; explicit `null` seeds a legacy run recorded before a worktree was guaranteed. */
  repositoryId?: string | null;
  /** Worktree the run owns. Pass the id of one a test acquired for real; omitted seeds a bare row. */
  worktreeId?: string;
  runStatus: RunState;
  stepStatus: StepRunState;
  sessionStatus: AgentSessionState;
  pid?: number | null;
  pgid?: number | null;
  providerSessionId?: string | null;
  /** The quota wait a `waiting_for_provider` step carries, schedule included. */
  providerWait?: StepProviderWait;
}

export interface SeededRun {
  runId: string;
  stepRunId: string;
  agentSessionId: string;
}

export interface SeedWorkflowStep {
  id: string;
  status: StepRunState;
  dependsOn?: string[];
  /** Halted step this one was appended to recover. */
  replaces?: string;
  name?: string;
  prompt?: string;
  providerWait?: StepProviderWait | null;
  sessionId?: string;
  session?: {
    status: AgentSessionState;
    providerSessionId?: string | null;
    pid?: number | null;
    pgid?: number | null;
  };
}

export interface SeedWorkflowOptions {
  runId: string;
  issueId?: string;
  /** Omitted uses `repo-1` when the fixture seeded it; explicit `null` seeds a legacy run recorded before a worktree was guaranteed. */
  repositoryId?: string | null;
  /** Worktree the run owns. Pass the id of one a test acquired for real; omitted seeds a bare row. */
  worktreeId?: string;
  runStatus: RunState;
  steps: SeedWorkflowStep[];
}

function resolveSeedRepository(db: Db, requested: string | null | undefined): string | null {
  if (requested === null) return null;
  if (requested === undefined) return getRepository(db, "repo-1") ? "repo-1" : null;
  if (!getRepository(db, requested)) {
    throw new Error(`seed: repository ${requested} is not seeded in this database`);
  }
  return requested;
}

/** Mirrors the worktree every launched run owns. The directory is never created: these fixtures reproduce crash leftovers, where the row outlives it. */
function seedWorktree(db: Db, runId: string, repositoryId: string): string {
  const id = `${runId}-worktree`;
  db.insert(schema.worktrees)
    .values({
      id,
      repository_id: repositoryId,
      path: join("/tmp/otomat-seeded-worktrees", runId),
      branch: `otomat/run/${runId}`,
      head_sha: "",
      base_sha: "",
      base_ref: "main",
      owner_token: runId,
      status: "active",
    })
    .run();
  return id;
}

/** Seeds a multi-step run (plan + step rows, sessions only where given) in arbitrary crash-leftover states; the returned lookup throws on an unknown step id. */
export function seedWorkflowRun(
  db: Db,
  options: SeedWorkflowOptions,
): (stepId: string) => SeededRun {
  const refs = new Map<string, SeededRun>();
  const repositoryId = resolveSeedRepository(db, options.repositoryId);
  const worktreeId =
    repositoryId === null
      ? null
      : (options.worktreeId ?? seedWorktree(db, options.runId, repositoryId));
  db.insert(schema.runs)
    .values({
      id: options.runId,
      issue_id: options.issueId ?? "i1",
      repository_id: repositoryId,
      worktree_id: worktreeId,
      status: options.runStatus,
      branch: `otomat/run/${options.runId}`,
      plan_json: {
        version: 1,
        steps: options.steps.map((step) => ({
          id: step.id,
          name: step.name ?? `Step ${step.id}`,
          agent: "fake",
          prompt: step.prompt ?? `p-${step.id}`,
          depends_on: step.dependsOn ?? [],
          replaces: step.replaces ?? null,
        })),
      },
    })
    .run();
  options.steps.forEach((step, index) => {
    db.insert(schema.stepRuns)
      .values({
        id: step.id,
        run_id: options.runId,
        idx: index,
        name: step.name ?? `Step ${step.id}`,
        status: step.status,
        provider_wait_json: step.providerWait ?? null,
      })
      .run();
    const sessionId = step.sessionId ?? `${step.id}-session`;
    if (step.session) {
      db.insert(schema.agentSessions)
        .values({
          id: sessionId,
          step_run_id: step.id,
          agent_id: null,
          status: step.session.status,
          provider_session_id: step.session.providerSessionId ?? null,
          pid: step.session.pid ?? null,
          pgid: step.session.pgid ?? null,
        })
        .run();
    }
    refs.set(step.id, {
      runId: options.runId,
      stepRunId: step.id,
      agentSessionId: sessionId,
    });
  });
  return (stepId) => {
    const ref = refs.get(stepId);
    if (!ref) throw new Error(`unknown seeded step ${stepId}`);
    return ref;
  };
}

/** Seeds a run/step/session chain in arbitrary (e.g. crash-leftover) states with optional process liveness. */
export function seedRun(db: Db, options: SeedRunOptions): SeededRun {
  const stepRunId = `${options.runId}-step`;
  const lookup = seedWorkflowRun(db, {
    runId: options.runId,
    issueId: options.issueId,
    repositoryId: options.repositoryId,
    worktreeId: options.worktreeId,
    runStatus: options.runStatus,
    steps: [
      {
        id: stepRunId,
        name: "Agent turn",
        prompt: "p",
        status: options.stepStatus,
        providerWait: options.providerWait ?? null,
        sessionId: `${options.runId}-session`,
        session: {
          status: options.sessionStatus,
          providerSessionId: options.providerSessionId ?? null,
          pid: options.pid ?? null,
          pgid: options.pgid ?? null,
        },
      },
    ],
  });
  return lookup(stepRunId);
}

export function firstStepOf(db: Db, runId: string): string {
  const [step] = listStepRunsForRun(db, runId);
  if (!step) throw new Error(`run ${runId} has no step`);
  return step.id;
}
