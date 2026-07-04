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
