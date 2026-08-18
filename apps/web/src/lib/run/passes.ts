import type { AgentSessionContract, RunDetail } from "@otomat/domain";

export interface RunPass {
  session: AgentSessionContract;
  stepName: string;
}

/** One per agent session, oldest first; a resume continues its session rather than opening a new pass. */
export function runPasses(detail: RunDetail): RunPass[] {
  const stepNames = new Map(detail.steps.map((step) => [step.id, step.name]));
  return detail.sessions.map((session) => ({
    session,
    stepName: stepNames.get(session.step_run_id) ?? "Unknown step",
  }));
}
