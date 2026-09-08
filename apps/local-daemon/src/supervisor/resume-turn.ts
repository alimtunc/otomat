import type { RunRow } from "@otomat/db";
import { agentSessionMachine } from "@otomat/domain";

import { readRunEvents } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { buildRecoveryPrompt } from "./recovery-prompt.js";
import type { ResumeAction } from "./resume-plan.js";
import {
  NATIVE_CONTINUATION,
  insertSessionResumeTurn,
  requireRunRow,
  requireWorktreePath,
  spawnResumeTurn,
} from "./resume.js";
import type { SupervisorState } from "./state.js";
import { insertTurn } from "./turn-scheduling.js";

type ReopenAction = Extract<ResumeAction, { kind: "native" | "recovery" }>;

/** Reopens one plan step in the run's own worktree — reattaching the provider session when it survives, and giving a fresh one a newly captured dossier plus why it exists. */
export async function spawnReopenTurn(
  state: SupervisorState,
  run: RunRow,
  action: ReopenAction,
): Promise<RunRow> {
  if (action.kind === "native" && !agentSessionMachine.isTerminal(action.session.status)) {
    return spawnResumeTurn(state, run, NATIVE_CONTINUATION);
  }

  if (action.kind === "native") {
    const turn = insertSessionResumeTurn(
      state,
      run,
      action.session,
      action.step.config ?? null,
      NATIVE_CONTINUATION,
      [],
    );
    await spawnTurn(state, turn.context, "resume", turn.providerSessionId);
    return requireRunRow(state.db, run.id, "resume");
  }

  const worktreePath = requireWorktreePath(state, run);
  const prompt = buildRecoveryPrompt({
    stepName: action.step.name,
    events: readRunEvents(state.db, run.id),
  });
  const context = insertTurn(state, run, action.step, worktreePath);
  await spawnTurn(state, { ...context, prompt }, "run", null);
  return requireRunRow(state.db, run.id, "resume");
}
