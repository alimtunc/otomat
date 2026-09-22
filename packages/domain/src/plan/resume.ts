import type { AgentSessionKind } from "../contracts/entities/runs.js";
import { isStepSettled, type StepRunState } from "../state-machines/step-run.js";

interface ResumableSession {
  step_run_id: string;
  kind: AgentSessionKind;
  provider_session_id: string | null;
}

interface ResumableStep {
  id: string;
  compete_group_id: string | null;
}

interface ResumableCompeteGroup {
  id: string;
  winner_step_run_id: string | null;
}

/** A candidate its group decided against: the worktree is archived, so no turn of it will ever run again. */
function isCompeteLoser(step: ResumableStep, groups: readonly ResumableCompeteGroup[]): boolean {
  if (step.compete_group_id === null) return false;
  const group = groups.find((candidate) => candidate.id === step.compete_group_id);
  if (!group || group.winner_step_run_id === null) return false;
  return group.winner_step_run_id !== step.id;
}

/** The session a follow-up on this step would resume: the newest one the provider can still be re-entered through. */
export function latestSessionForStep<Session extends ResumableSession>(
  sessions: readonly Session[],
  stepRunId: string,
): Session | undefined {
  return stepSessions(sessions, stepRunId).at(-1);
}

/** A supervision turn names the step it judges without being one of its turns; every step-scoped read excludes it. */
export function stepSessions<Session extends ResumableSession>(
  sessions: readonly Session[],
  stepRunId: string,
): Session[] {
  return sessions.filter((session) => session.step_run_id === stepRunId && session.kind === "step");
}

export type StepContributionRoute = "steering" | "first_turn";

/** `null` means no turn will ever carry the message, so no surface may promise delivery. */
export function resolveStepContributionRoute<Session extends ResumableSession>(
  step: ResumableStep & { status: StepRunState },
  sessions: readonly Session[],
  groups: readonly ResumableCompeteGroup[],
): StepContributionRoute | null {
  if (isCompeteLoser(step, groups)) return null;
  if (latestSessionForStep(sessions, step.id)) return "steering";
  // A settled step that never opened a session has no first turn left to carry anything.
  return isStepSettled(step.status) ? null : "first_turn";
}
