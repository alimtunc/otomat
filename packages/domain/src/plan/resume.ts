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
  winner_step_run_id: string | null;
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
