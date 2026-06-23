import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, runMigrations, schema, type DbClient } from "@otomat/db";

import type { RuntimeEvent } from "#runtime";

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
  const dir = mkdtempSync(join(tmpdir(), "otomat-events-"));
  const dbPath = join(dir, "otomat.db");
  runMigrations(dbPath);
  const client = createClient(dbPath);

  const runId = "run-1";
  const stepRunId = "step-1";
  const agentSessionId = "sess-1";

  client.db.insert(schema.projects).values({ id: "p1", name: "P", root_path: dir }).run();
  client.db.insert(schema.issues).values({ id: "i1", project_id: "p1", title: "I" }).run();
  client.db
    .insert(schema.runs)
    .values({
      id: runId,
      issue_id: "i1",
      status: "running",
      branch: "alimtunc/oto-7",
      plan_json: { version: 1, steps: [] },
    })
    .run();
  client.db
    .insert(schema.stepRuns)
    .values({ id: stepRunId, run_id: runId, idx: 0, name: "scaffold" })
    .run();
  client.db
    .insert(schema.agentSessions)
    .values({ id: agentSessionId, step_run_id: stepRunId })
    .run();

  return {
    client,
    dir,
    runId,
    stepRunId,
    agentSessionId,
    cleanup() {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function makeEvent(
  runId: string,
  index: number,
  overrides: Partial<RuntimeEvent> = {},
): RuntimeEvent {
  return {
    id: `${runId}:${index}`,
    run_id: runId,
    step_run_id: null,
    agent_session_id: null,
    type: "runtime.log",
    source: "otomat",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: { fidelity: "raw_log", adapter: "fake", test_adapter: true, text: `e${index}` },
    raw_ref: null,
    ...overrides,
  };
}
