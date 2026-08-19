import { setStepProviderWait, type Db } from "@otomat/db";
import type { ProviderLimit, StepProviderWait } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { buildProviderWaitEvent, type SessionRef } from "../markers.js";

export function recordProviderWait(
  db: Db,
  dataDir: string,
  ref: SessionRef & { stepRunId: string },
  limit: ProviderLimit,
  now: string,
): StepProviderWait {
  // A reset already behind us says nothing about the window we just hit, so the wait
  // stays actionable and asks for a time instead of resuming into the same wall.
  const proved = limit.resume_at;
  const wait: StepProviderWait = {
    provider: limit.provider,
    reason: limit.reason,
    detected_at: now,
    provider_resume_at: proved,
    resume_at: proved !== null && proved > now ? proved : null,
  };
  setStepProviderWait(db, ref.stepRunId, wait);
  emitLedgerEvent(db, dataDir, ref.runId, buildProviderWaitEvent(ref, wait, now));
  return wait;
}
