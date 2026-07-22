import { getAgent, upsertAgent, type Db, type RunRow } from "@otomat/db";
import { executableSteps } from "@otomat/domain";

import { createRuntimeAdapter, requireAvailableRuntime, type KnownRuntimeId } from "#runtime";

export { requireAvailableRuntime } from "#runtime";

/** Validates the runtime, refuses an unavailable one, and ensures its builtin agent row exists (FK for `runs.agent_id` / `agent_sessions.agent_id`). */
export function ensureRuntimeAgent(
  db: Db,
  requested: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): KnownRuntimeId {
  const runtime = requireAvailableRuntime(requested, env);
  upsertAgent(db, { id: runtime, name: createRuntimeAdapter(runtime).displayName, runtime });
  return runtime;
}

/** The runtime a follow-up turn must reuse: the run's agent row first, else its frozen plan; undefined only on a corrupt row, which the resume guard rejects. */
export function runtimeForRun(db: Db, run: RunRow): string | undefined {
  const fromAgent = run.agent_id === null ? undefined : getAgent(db, run.agent_id)?.runtime;
  return fromAgent ?? executableSteps(run.plan_json)[0]?.agent ?? undefined;
}
