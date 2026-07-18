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
  name?: string;
  prompt?: string;
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
  runStatus: RunState;
  steps: SeedWorkflowStep[];
}

/** Seeds a multi-step run (plan + step rows, sessions only where given) in arbitrary crash-leftover states; the returned lookup throws on an unknown step id. */
export function seedWorkflowRun(
  db: Db,
  options: SeedWorkflowOptions,
): (stepId: string) => SeededRun {
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
          name: step.name ?? `Step ${step.id}`,
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
        name: step.name ?? `Step ${step.id}`,
        status: step.status,
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
    runStatus: options.runStatus,
    steps: [
      {
        id: stepRunId,
        name: "Agent turn",
        prompt: "p",
        status: options.stepStatus,
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
