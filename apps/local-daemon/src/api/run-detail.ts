import type { Context, Env } from "hono";

import type { ApiDeps } from "./deps.js";
import { readRunDetail } from "./reads.js";

/** Read back with the supervisor's wait and resume plan in the same tick, so a command's answer and the reason the run is queued agree. */
export function runDetailJson<E extends Env>(deps: ApiDeps, c: Context<E>, runId: string) {
  const detail = readRunDetail(deps.db, runId, {
    wait: deps.supervisor.waitFor(runId),
    resume: deps.supervisor.resumePlan(runId),
  });
  return detail ? c.json(detail) : c.json({ error: "run_not_found" }, 404);
}
