import { getAgent, upsertAgent, type Db, type RunRow } from "@otomat/db";
import { FAKE_RUNTIME_ID } from "@otomat/domain";

import {
  createRuntimeAdapter,
  isKnownRuntimeId,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

/** Validates the requested runtime against the registry and guarantees its builtin agent row exists (FK for `runs.agent_id`). */
export function ensureRuntimeAgent(db: Db, requested: string | undefined): KnownRuntimeId {
  const runtime = requested ?? FAKE_RUNTIME_ID;
  if (!isKnownRuntimeId(runtime)) throw new UnknownRuntimeError(runtime);
  upsertAgent(db, { id: runtime, name: createRuntimeAdapter(runtime).displayName, runtime });
  return runtime;
}

/** The runtime a follow-up turn must reuse: the run's agent row first, else its frozen plan; undefined only on a corrupt row, which the resume guard rejects. */
export function runtimeForRun(db: Db, run: RunRow): string | undefined {
  const fromAgent = run.agent_id === null ? undefined : getAgent(db, run.agent_id)?.runtime;
  return fromAgent ?? run.plan_json.steps[0]?.agent ?? undefined;
}
