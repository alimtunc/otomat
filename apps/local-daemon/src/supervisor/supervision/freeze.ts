import type { Db } from "@otomat/db";
import {
  overrideLevel,
  type StartRunRequest,
  type Supervision,
  type SupervisionRequest,
} from "@otomat/domain";

import { resolveAgentConfig, type AgentConfigSelector } from "#agents";

function supervisorSelector(requested: SupervisionRequest): AgentConfigSelector {
  if (requested.profile_id) return { kind: "profile", profileId: requested.profile_id };
  if (requested.runtime) return { kind: "runtime", runtimeId: requested.runtime };
  throw new Error("a supervised run must name a supervisor runtime or profile");
}

/** Frozen at launch like a plan node's agent, so a profile edited later cannot change who judged a step. */
export function freezeSupervision(db: Db, request: StartRunRequest): Supervision | null {
  const requested = request.supervision;
  if (!requested) return null;
  const config = resolveAgentConfig(db, supervisorSelector(requested), {
    levels: [overrideLevel("launch", { model: requested.model, options: requested.options })],
    runtimeSource: "launch",
  });
  return { config, max_loops: requested.max_loops, budget_usd: requested.budget_usd };
}
