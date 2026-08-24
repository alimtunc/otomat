import { recordRunInteraction, type RunInteractionRow } from "@otomat/db";
import type { RunInteractionsResponse } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { RunInteractionRefusedError } from "#supervisor";

import { interactionRow, json, makeApiApp, post, request, stubSupervisor } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-interactions-");
});

afterEach(() => {
  t.cleanup();
});

const RUN = "run-ask";
const ALLOW = { kind: "permission", decision: "allow" } as const;

function seedAsk(): RunInteractionRow {
  const seeded = seedRun(t.db, {
    runId: RUN,
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  const row = interactionRow(RUN, {
    step_run_id: seeded.stepRunId,
    agent_session_id: seeded.agentSessionId,
  });
  recordRunInteraction(t.db, row);
  return row;
}

it("lists the questions a run is waiting on, and nothing another run's turn asked", async () => {
  seedAsk();
  const other = seedRun(t.db, {
    runId: "run-other",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  recordRunInteraction(
    t.db,
    interactionRow("run-other", {
      id: "interaction-other",
      provider_request_id: "req-other",
      step_run_id: other.stepRunId,
      agent_session_id: other.agentSessionId,
    }),
  );
  const app = makeApiApp(t);

  const body = await json<RunInteractionsResponse>(
    await request(app, `/api/runs/${RUN}/interactions`),
  );

  expect(body.run_id).toBe(RUN);
  expect(body.interactions).toMatchObject([
    { provider_request_id: "req-1", kind: "permission", state: "pending", tool: "Write" },
  ]);
});

it("answers a question through the daemon and returns the settled request", async () => {
  const row = seedAsk();
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      answerInteraction: async () => ({
        ...row,
        state: "answered" as const,
        answer_json: ALLOW,
        settled_at: "2026-01-02T00:00:00.000Z",
      }),
    }),
  });

  const response = await post(app, `/api/runs/${RUN}/interactions/${row.id}/answer`, {
    answer: ALLOW,
  });

  expect(response.status).toBe(200);
  expect(await json(response)).toMatchObject({ state: "answered", answer: ALLOW });
});

it("passes the daemon's refusal through with its own code rather than a generic failure", async () => {
  const row = seedAsk();
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      answerInteraction: () => {
        throw new RunInteractionRefusedError(
          "run_interaction_unreachable",
          "The turn that asked this question is no longer running.",
        );
      },
    }),
  });

  const response = await post(app, `/api/runs/${RUN}/interactions/${row.id}/answer`, {
    answer: ALLOW,
  });

  expect(response.status).toBe(409);
  expect(await json(response)).toMatchObject({
    error: "run_interaction_unreachable",
    message: "The turn that asked this question is no longer running.",
  });
});

it("refuses an answer whose shape is not one this contract defines", async () => {
  const row = seedAsk();
  const app = makeApiApp(t);

  const response = await post(app, `/api/runs/${RUN}/interactions/${row.id}/answer`, {
    answer: { kind: "permission", decision: "maybe" },
  });

  expect(response.status).toBe(400);
});
