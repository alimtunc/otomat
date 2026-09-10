import {
  planStepFor,
  stepSessions,
  type AgentSessionContract,
  type ResolvedAgentConfig,
  type RunDetail,
} from "@otomat/domain";

export interface StepParticipant {
  session: AgentSessionContract | null;
  /** Newest turn the provider actually started — the model the step really ran with, never the pending one. */
  launched: AgentSessionContract | null;
  pending: ResolvedAgentConfig | null;
  launchedConfig: ResolvedAgentConfig | null;
  config: ResolvedAgentConfig | null;
}

export function stepParticipant(detail: RunDetail, stepRunId: string): StepParticipant {
  const sessions = stepSessions(detail.sessions, stepRunId);
  const session = sessions.at(-1) ?? null;
  // Sessions recorded before `started_at` existed carry null there; any state past `created` proves the turn ran.
  const launched =
    sessions.findLast((row) => row.started_at !== null || row.status !== "created") ?? null;
  const planned = planStepFor(detail.run.plan_json, stepRunId);
  const pending = detail.steps.find((row) => row.id === stepRunId)?.next_turn_config ?? null;
  return {
    session,
    launched,
    pending,
    launchedConfig: launched?.config ?? planned?.config ?? null,
    config: pending ?? session?.config ?? planned?.config ?? null,
  };
}
