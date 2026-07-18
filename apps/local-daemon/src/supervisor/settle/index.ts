import {
  listAgentSessionsForRun,
  listStepRunsForRun,
  updateAgentSessionProvider,
  type Db,
} from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { drainRunEvents, readRunEvents, runDir } from "#events";

import { classify, describe, TARGETS } from "../classify.js";
import { eventsForSession, findFinalStatus, findProviderSessionId } from "../evidence.js";
import type { ReconcileOutcome } from "../types.js";
import {
  resolveTurnSession,
  type SettleableRun,
  type SettleContext,
  type SettleEvidence,
  type SettleOptions,
} from "./context.js";
import { settleIdleRun } from "./idle.js";
import { settleFromWholeLedger } from "./ledger.js";
import { recordObservedExit, reapProcesses } from "./reap.js";
import { settleTurn } from "./turn.js";

export {
  resolveTurnSession,
  stepStatuses,
  type SettleableRun,
  type SettleOptions,
} from "./context.js";

/** Shared by the live exit path, abort, and boot reconciliation; a no-op on an already-terminal run, so re-running is safe. */
export function settleRun(
  db: Db,
  dataDir: string,
  run: SettleableRun,
  options: SettleOptions,
): ReconcileOutcome | null {
  if (runMachine.isTerminal(run.status)) return null;

  drainRunEvents(db, dataDir, run.id);

  const events = readRunEvents(db, run.id);
  const sessions = listAgentSessionsForRun(db, run.id);
  const steps = listStepRunsForRun(db, run.id);
  const plan = run.plan_json ?? null;

  const turnSession = resolveTurnSession(sessions, options.turn);
  recordObservedExit(db, turnSession, options);
  const orphanTerminated = reapProcesses(db, runDir(dataDir, run.id), sessions, options);
  const ctx: SettleContext = { db, dataDir, run, steps, sessions, options, orphanTerminated };

  if (plan !== null && turnSession === null) return settleIdleRun(ctx, plan);

  // A multi-step ledger holds one terminal marker per turn — only this session's slice is evidence for this settle.
  const scoped = turnSession === null ? events : eventsForSession(events, turnSession.id);
  const finalStatus = findFinalStatus(scoped);
  const providerSessionId = findProviderSessionId(scoped);
  const classification = classify(finalStatus, providerSessionId);
  const evidence: SettleEvidence = {
    classification,
    reason: describe(classification, providerSessionId, orphanTerminated),
    providerSessionId,
    targets: TARGETS[classification],
  };

  if (
    providerSessionId !== null &&
    turnSession !== null &&
    turnSession.provider_session_id === null
  ) {
    updateAgentSessionProvider(db, turnSession.id, providerSessionId);
  }

  if (plan === null || turnSession === null) return settleFromWholeLedger(ctx, evidence);
  return settleTurn(ctx, plan, turnSession, evidence);
}
