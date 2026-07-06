import type { DbClient } from "@otomat/db";

import { setupTestDb } from "./db.js";
import { seedRun } from "./seed.js";

export interface LedgerTestDb {
  client: DbClient;
  dir: string;
  runId: string;
  stepRunId: string;
  agentSessionId: string;
  cleanup(): void;
}

// Seeds the full project->issue->run->step_run->agent_session chain so runtime_events FKs resolve.
export function setupLedgerDb(): LedgerTestDb {
  const base = setupTestDb("otomat-events-");
  const seeded = seedRun(base.db, {
    runId: "run-1",
    runStatus: "running",
    stepStatus: "queued",
    sessionStatus: "created",
  });
  return {
    client: base.client,
    dir: base.dir,
    runId: seeded.runId,
    stepRunId: seeded.stepRunId,
    agentSessionId: seeded.agentSessionId,
    cleanup: base.cleanup,
  };
}
