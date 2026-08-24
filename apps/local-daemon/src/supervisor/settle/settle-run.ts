import {
  listAgentSessionsForRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  recordAgentSessionReportedModel,
  updateAgentSessionProvider,
  type Db,
} from "@otomat/db";
import { isRunSettled } from "@otomat/domain";

import { drainRunEvents, drainSessionEvents, readRunEvents } from "#events";

import { classify, describe, TARGETS } from "../classify.js";
import {
  eventsForSession,
  findFinalStatus,
  findProviderLimit,
  findProviderSessionId,
  findReportedModel,
} from "../evidence.js";
import { cancelSessionInteractions, ingestRunInteractions } from "../interaction/index.js";
import { recordProviderWait } from "../provider-wait/record.js";
import type { ReconcileOutcome } from "../types.js";
import {
  resolveTurnSession,
  type SettleableRun,
  type SettleContext,
  type SettleEvidence,
  type SettleOptions,
} from "./context.js";
import { resolveSessionContributions } from "./contributions.js";
import { settleIdleRun } from "./idle.js";
import { settleFromWholeLedger } from "./ledger.js";
import { recordObservedExit, reapProcesses } from "./reap.js";
import { settleTurn } from "./turn.js";

/** Shared by the live exit path, abort, and boot reconciliation; a no-op on an already-terminal run, so re-running is safe. */
export function settleRun(
  db: Db,
  dataDir: string,
  run: SettleableRun,
  options: SettleOptions,
): ReconcileOutcome | null {
  if (isRunSettled(run.status)) return null;

  drainRunEvents(db, dataDir, run.id);

  const sessions = listAgentSessionsForRun(db, run.id);
  for (const session of sessions) drainSessionEvents(db, dataDir, run.id, session.id);
  const events = readRunEvents(db, run.id);
  const steps = listStepRunsForRun(db, run.id);
  const groups = listCompeteGroupsForRun(db, run.id);
  const plan = run.plan_json ?? null;

  const turnSession = resolveTurnSession(sessions, options.turn);
  recordObservedExit(db, turnSession, options);
  const orphanTerminated = reapProcesses(db, dataDir, run.id, sessions, options);
  const ctx: SettleContext = {
    db,
    dataDir,
    run,
    steps,
    sessions,
    groups,
    options,
    orphanTerminated,
  };

  if (plan !== null && turnSession === null) return settleIdleRun(ctx, plan);

  const scoped = turnSession === null ? events : eventsForSession(events, turnSession.id);
  const finalStatus = findFinalStatus(scoped);
  const providerSessionId = findProviderSessionId(scoped);
  const providerLimit = findProviderLimit(scoped);
  const reportedModel = findReportedModel(scoped);
  const classification = classify(finalStatus, providerSessionId, providerLimit);
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
  if (reportedModel !== null && turnSession !== null) {
    recordAgentSessionReportedModel(db, turnSession.id, reportedModel);
  }
  if (turnSession !== null) {
    resolveSessionContributions(db, turnSession.id, classification, options.now);
    // Promotes any ledgered ask no pass reached into its row first: the cancel closes rows, and an unpromoted ask would otherwise resurrect as a pending question on the next turn.
    ingestRunInteractions(db, run.id);
    cancelSessionInteractions(
      db,
      dataDir,
      turnSession.id,
      "the turn that asked this question ended before it was answered",
      options.now,
    );
    // Persisted before the step reaches `waiting_for_provider`, so the state and the schedule it stands for land together.
    if (classification === "provider_limited" && providerLimit !== null) {
      recordProviderWait(
        db,
        dataDir,
        { runId: run.id, stepRunId: turnSession.step_run_id, agentSessionId: turnSession.id },
        providerLimit,
        options.now,
      );
    }
  }

  if (plan === null || turnSession === null) return settleFromWholeLedger(ctx, evidence);
  return settleTurn(ctx, plan, turnSession, evidence);
}
