import { existsSync } from "node:fs";

import { getIssue, listStepRunsForRun, type RunRow } from "@otomat/db";
import { agentSessionMachine } from "@otomat/domain";

import { readRunEvents } from "#events";
import { diffOrNull, uncommittedPaths, type CanonicalDiff } from "#git";

import { spawnTurn } from "./lifecycle.js";
import { buildRecoveryPrompt } from "./recovery-prompt.js";
import type { ResumeAction } from "./resume-plan.js";
import {
  requireRunRow,
  requireWorktreePath,
  RunNotResumableError,
  spawnResumeTurn,
} from "./resume.js";
import type { SupervisorState } from "./state.js";
import { insertTurn } from "./turn-scheduling.js";

type ReopenAction = Extract<ResumeAction, { kind: "native" | "recovery" }>;

/** A native resume needs no context rebuild: the provider still holds the whole conversation. */
const NATIVE_CONTINUATION = [
  "Your previous turn stopped before finishing. You still have this session's",
  "context and the same worktree. Check what you had already changed, then continue",
  "from where you stopped.",
].join("\n");

/** A worktree that is gone leaves the prompt saying so; any other git failure is a real fault and propagates. */
function worktreeDiff(
  state: SupervisorState,
  run: RunRow,
  worktreePath: string,
): CanonicalDiff | null {
  const service = state.repositories.forRepository(run.repository_id)?.service;
  if (!service || !existsSync(worktreePath)) return null;
  return diffOrNull(service, run.id);
}

function recoveryPrompt(
  state: SupervisorState,
  run: RunRow,
  action: Extract<ReopenAction, { kind: "recovery" }>,
  worktreePath: string,
): string {
  const issue = getIssue(state.db, run.issue_id);
  return buildRecoveryPrompt({
    issueTitle: issue?.title ?? run.branch,
    issueBody: issue?.body ?? null,
    branch: run.branch,
    stepName: action.step.name,
    stepPrompt: action.step.prompt,
    steps: listStepRunsForRun(state.db, run.id),
    events: readRunEvents(state.db, run.id),
    diff: worktreeDiff(state, run, worktreePath),
    uncommittedFiles: existsSync(worktreePath) ? uncommittedPaths(worktreePath).length : 0,
  });
}

/** Reopens one plan step in the run's own worktree — reattaching the provider session when it survives, handing the durable context to a fresh one when it does not. */
export async function spawnReopenTurn(
  state: SupervisorState,
  run: RunRow,
  action: ReopenAction,
): Promise<RunRow> {
  if (action.kind === "native" && !agentSessionMachine.isTerminal(action.session.status)) {
    const { prompt } = action.step;
    if (prompt === null) throw new RunNotResumableError(`run ${run.id} step has no prompt`);
    return spawnResumeTurn(state, run, prompt);
  }

  const worktreePath = requireWorktreePath(state, run);
  const prompt =
    action.kind === "native"
      ? NATIVE_CONTINUATION
      : recoveryPrompt(state, run, action, worktreePath);
  const context = insertTurn(state, run, action.step, worktreePath);
  await spawnTurn(
    state,
    { ...context, prompt },
    action.kind === "native" ? "resume" : "run",
    action.kind === "native" ? action.session.provider_session_id : null,
  );
  return requireRunRow(state.db, run.id, "resume");
}
