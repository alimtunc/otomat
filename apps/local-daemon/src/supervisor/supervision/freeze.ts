import type { Db } from "@otomat/db";
import { overrideLevel, type StartRunRequest, type Supervision } from "@otomat/domain";

import { nodeAgentSelector, resolveAgentConfig } from "#agents";

/** Frozen at launch like a plan node's agent, so a profile edited later cannot change who judged a step. */
export function freezeSupervision(db: Db, request: StartRunRequest): Supervision | null {
  const requested = request.supervision;
  if (!requested) return null;
  const selector = nodeAgentSelector({
    agent: requested.runtime ?? null,
    profile_id: requested.profile_id,
  });
  if (selector === null)
    throw new Error("a supervised run must name a supervisor runtime or profile");
  const config = resolveAgentConfig(db, selector, {
    levels: [overrideLevel("launch", { model: requested.model, options: requested.options })],
    runtimeSource: "launch",
  });
  return { config, max_loops: requested.max_loops, budget_usd: requested.budget_usd };
}
