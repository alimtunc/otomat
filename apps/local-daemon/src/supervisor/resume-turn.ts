import { randomUUID } from "node:crypto";

import {
  insertAgentSession,
  listAgentSessionsForRun,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import { agentSessionMachine } from "@otomat/domain";

import { readRunEvents, sessionDir } from "#events";

import { spawnTurn } from "./lifecycle.js";
import { buildRecoveryPrompt } from "./recovery-prompt.js";
import type { ResumeAction } from "./resume-plan.js";
import {
  NATIVE_CONTINUATION,
  insertSessionResumeTurn,
  requireRunRow,
  requireResumableRuntime,
  RunNotResumableError,
  requireWorktreePath,
  spawnResumeTurn,
} from "./resume.js";
import type { SupervisorState } from "./state.js";
import { driveCompeteGroupTo } from "./transitions.js";
import { insertTurn, scheduleTurn } from "./turn-scheduling.js";
import type { TurnContext } from "./types.js";

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

interface ResumableCandidate {
  context: TurnContext;
  providerSessionId: string;
  revised: boolean;
}

export async function resumeCompeteGroup(
  state: SupervisorState,
  run: RunRow,
  action: Extract<ResumeAction, { kind: "compete_group" }>,
  steps: readonly StepRunRow[],
): Promise<RunRow> {
  const { group } = action;
  const candidates = steps.filter(
    (step) =>
      step.compete_group_id === group.id &&
      (step.status === "awaiting_human" || step.status === "waiting_for_provider"),
  );
  const sessions = listAgentSessionsForRun(state.db, run.id);
  const service = state.repositories.forRepository(run.repository_id)?.service;
  if (!service) {
    throw new RunNotResumableError(`compete group ${group.id} repository is unavailable`);
  }
  const contexts = candidates.map((candidate): ResumableCandidate => {
    const session = sessions.findLast(
      (entry) => entry.step_run_id === candidate.id && entry.provider_session_id !== null,
    );
    const planStep = action.competitors.find((entry) => entry.id === candidate.id);
    if (!session || session.provider_session_id === null || !planStep) {
      throw new RunNotResumableError(`competitor ${candidate.id} has no resumable session`);
    }
    const knownRuntime = requireResumableRuntime(state.db, run, session);
    const worktreePath = service.get(candidate.id)?.path;
    if (!worktreePath) {
      throw new RunNotResumableError(`competitor ${candidate.id} worktree is unavailable`);
    }
    return {
      context: {
        runId: run.id,
        stepRunId: candidate.id,
        agentSessionId: session.id,
        kind: "step",
        prompt: planStep.prompt ?? NATIVE_CONTINUATION,
        contextSelection: planStep.context ?? null,
        agentSessionDir: sessionDir(state.dataDir, run.id, session.id),
        worktreePath,
        runtime: knownRuntime,
        config: planStep.config ?? null,
      },
      providerSessionId: session.provider_session_id,
      revised: planStep.config?.config_hash !== session.config_json?.config_hash,
    };
  });
  if (contexts.length === 0) {
    throw new RunNotResumableError(`compete group ${group.id} has no interrupted competitor`);
  }
  driveCompeteGroupTo(state.db, group.id, group.status, "running");
  const launches = contexts.map(({ context, providerSessionId, revised }) => {
    if (revised) {
      const id = randomUUID();
      insertAgentSession(state.db, {
        id,
        step_run_id: context.stepRunId,
        agent_id: context.runtime,
        status: agentSessionMachine.initial,
        provider_session_id: providerSessionId,
        resumed_from_session_id: context.agentSessionId,
        config_json: context.config,
      });
      context = {
        ...context,
        agentSessionId: id,
        agentSessionDir: sessionDir(state.dataDir, run.id, id),
      };
    }
    return scheduleTurn(state, context, "resume", providerSessionId);
  });
  await launches[0];
  return requireRunRow(state.db, run.id, "resume");
}
