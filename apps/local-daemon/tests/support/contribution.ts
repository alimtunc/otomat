import { getRun, listAgentSessionsForRun, type Db } from "@otomat/db";
import { executableSteps } from "@otomat/domain";

import type { Supervisor } from "#supervisor";

export async function contributeToStep(
  db: Db,
  supervisor: Supervisor,
  runId: string,
  stepRunId: string,
  body: string,
) {
  const run = getRun(db, runId);
  const session = listAgentSessionsForRun(db, runId).findLast(
    (candidate) => candidate.step_run_id === stepRunId,
  );
  const config =
    session?.config_json ??
    (run ? executableSteps(run.plan_json).find((step) => step.id === stepRunId)?.config : null);
  if (!config) throw new Error(`test step ${stepRunId} has no frozen config`);
  return supervisor.contribute(runId, stepRunId, session?.id ?? null, config.config_hash, body);
}
