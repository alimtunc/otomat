import { getAgent, upsertAgent, type Db, type RunRow } from "@otomat/db";
import { FAKE_RUNTIME_ID, isRunPlanCompeteGroup } from "@otomat/domain";

import {
  createRuntimeAdapter,
  describeRuntimeAvailability,
  isKnownRuntimeId,
  RuntimeUnavailableError,
  UnknownRuntimeError,
  type KnownRuntimeId,
} from "#runtime";

/** Validates the runtime id and refuses an unavailable one (missing CLI binary, or fake outside tests/dev) without writing anything. */
export function requireAvailableRuntime(
  requested: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): KnownRuntimeId {
  const runtime = requested ?? FAKE_RUNTIME_ID;
  if (!isKnownRuntimeId(runtime)) throw new UnknownRuntimeError(runtime);
  const availability = describeRuntimeAvailability(runtime, env);
  if (availability.status === "unavailable") {
    throw new RuntimeUnavailableError(runtime, availability.reason);
  }
  return runtime;
}

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
  const firstNode = run.plan_json.steps[0];
  let fromPlan: string | null | undefined;
  if (firstNode) {
    fromPlan = isRunPlanCompeteGroup(firstNode) ? firstNode.compete[0]?.agent : firstNode.agent;
  }
  return fromAgent ?? fromPlan ?? undefined;
}
