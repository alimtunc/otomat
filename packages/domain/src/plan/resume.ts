import { isStepSettled, type StepRunState } from "../state-machines/step-run.js";

interface ResumableSession {
  step_run_id: string;
  provider_session_id: string | null;
}

interface ResumableStep {
  id: string;
  idx: number;
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
  return sessions.filter((session) => session.step_run_id === stepRunId).at(-1);
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

/** The latest resumable session on the furthest eligible step; losing compete candidates are excluded. */
export function selectLatestResumableSession<Session extends ResumableSession>(
  sessions: readonly Session[],
  steps: readonly ResumableStep[],
  groups: readonly ResumableCompeteGroup[],
): Session | undefined {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const winnerStepIds = new Set(
    groups.flatMap((group) =>
      group.winner_step_run_id === null ? [] : [group.winner_step_run_id],
    ),
  );
  let latest: Session | undefined;
  let latestStepIndex = -1;
  for (const session of sessions) {
    if (session.provider_session_id === null) continue;
    const step = stepById.get(session.step_run_id);
    if (step?.compete_group_id && !winnerStepIds.has(step.id)) continue;
    const stepIndex = step?.idx ?? -1;
    if (stepIndex >= latestStepIndex) {
      latest = session;
      latestStepIndex = stepIndex;
    }
  }
  return latest;
}
