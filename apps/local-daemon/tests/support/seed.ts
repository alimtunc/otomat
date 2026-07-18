import { schema, type Db } from "@otomat/db";
import type { AgentSessionState, RunState, StepRunState } from "@otomat/domain";

export interface SeedRunOptions {
  runId: string;
  issueId?: string;
  runStatus: RunState;
  stepStatus: StepRunState;
  sessionStatus: AgentSessionState;
  pid?: number | null;
  pgid?: number | null;
  providerSessionId?: string | null;
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
  prompt?: string;
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
  runStatus: RunState;
  steps: SeedWorkflowStep[];
}

/** Seeds a multi-step run (plan + step rows, sessions only where given) in arbitrary crash-leftover states. */
export function seedWorkflowRun(db: Db, options: SeedWorkflowOptions): Map<string, SeededRun> {
  const refs = new Map<string, SeededRun>();
  db.insert(schema.runs)
    .values({
      id: options.runId,
      issue_id: options.issueId ?? "i1",
      status: options.runStatus,
      branch: `otomat/run/${options.runId}`,
      plan_json: {
        version: 1,
        steps: options.steps.map((step) => ({
          id: step.id,
          name: `Step ${step.id}`,
          agent: "fake",
          prompt: step.prompt ?? `p-${step.id}`,
          depends_on: step.dependsOn ?? [],
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
        name: `Step ${step.id}`,
        status: step.status,
      })
      .run();
    const sessionId = `${step.id}-session`;
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
  return refs;
}

/** Seeds a run/step/session chain in arbitrary (e.g. crash-leftover) states with optional process liveness. */
export function seedRun(db: Db, options: SeedRunOptions): SeededRun {
  const stepRunId = `${options.runId}-step`;
  const agentSessionId = `${options.runId}-session`;
  db.insert(schema.runs)
    .values({
      id: options.runId,
      issue_id: options.issueId ?? "i1",
      status: options.runStatus,
      branch: `otomat/run/${options.runId}`,
      plan_json: {
        version: 1,
        steps: [{ id: stepRunId, name: "Agent turn", agent: "fake", prompt: "p", depends_on: [] }],
      },
    })
    .run();
  db.insert(schema.stepRuns)
    .values({
      id: stepRunId,
      run_id: options.runId,
      idx: 0,
      name: "Agent turn",
      status: options.stepStatus,
    })
    .run();
  db.insert(schema.agentSessions)
    .values({
      id: agentSessionId,
      step_run_id: stepRunId,
      status: options.sessionStatus,
      provider_session_id: options.providerSessionId ?? null,
      pid: options.pid ?? null,
      pgid: options.pgid ?? null,
    })
    .run();
  return { runId: options.runId, stepRunId, agentSessionId };
}
