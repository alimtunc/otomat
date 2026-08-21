import { readFileSync } from "node:fs";
import { join } from "node:path";

import { appendRunContribution, claimRunContributions, listRunContributions } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { sessionDir } from "#events";
import { appendLiveInput, createLiveInputChannel } from "#supervisor/live-input";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedWorkflowRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const STEP = "s-live";
const RUN = "r-live";

/** A run resting on a resumable session of `agent`: resuming it puts that runtime's turn in flight. */
function seedSteerableRun(agent: string): { stepRunId: string; agentSessionId: string } {
  return seedWorkflowRun(fix.db, {
    runId: RUN,
    runStatus: "awaiting_human",
    steps: [
      {
        id: STEP,
        agent,
        status: "awaiting_human",
        session: { status: "awaiting_input", providerSessionId: `ps-${agent}` },
      },
    ],
  })(STEP);
}

function contributions() {
  return listRunContributions(fix.db, RUN);
}

function inboxBodies(agentSessionId: string): string[] {
  const path = join(sessionDir(fix.dataDir, RUN, agentSessionId), "live-input.jsonl");
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line).body);
}

it("reaches the running invocation without starting a second turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "live");
  const seeded = seedSteerableRun("claude");
  await supervisor.resume(RUN);
  expect(spawn.calls).toBe(1);

  const delivered = await supervisor.contribute(RUN, seeded.stepRunId, "also update the changelog");

  expect(delivered.status).toBe("delivered");
  expect(delivered.agent_session_id).toBe(seeded.agentSessionId);
  expect(delivered.delivered_at).not.toBeNull();
  // Same process, same session: nothing was spawned to carry the message.
  expect(spawn.calls).toBe(1);
  expect(inboxBodies(seeded.agentSessionId)).toEqual(["also update the changelog"]);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("carries two live messages exactly once, in send order", async () => {
  const { supervisor } = makeSupervisor(fix, "live");
  const seeded = seedSteerableRun("claude");
  await supervisor.resume(RUN);

  await supervisor.contribute(RUN, seeded.stepRunId, "first message");
  await supervisor.contribute(RUN, seeded.stepRunId, "second message");

  expect(contributions().map((row) => row.body)).toEqual(["first message", "second message"]);
  expect(contributions().every((row) => row.status === "delivered")).toBe(true);
  expect(contributions().every((row) => row.attempts === 1)).toBe(true);
  expect(inboxBodies(seeded.agentSessionId)).toEqual(["first message", "second message"]);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("returns a message the live channel refused to the queue for the next turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "live-refuse");
  const seeded = seedSteerableRun("claude");
  await supervisor.resume(RUN);

  const refused = await supervisor.contribute(RUN, seeded.stepRunId, "steer me");

  expect(refused.status).toBe("queued");
  expect(refused.agent_session_id).toBeNull();
  expect(refused.delivered_at).toBeNull();
  expect(refused.attempts).toBe(1);
  expect(spawn.calls).toBe(1);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("keeps a message queued for the next turn when the runtime has no live input", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger");
  const seeded = seedSteerableRun("fake");
  await supervisor.resume(RUN);

  const queued = await supervisor.contribute(RUN, seeded.stepRunId, "also update the changelog");

  expect(queued.status).toBe("queued");
  expect(queued.agent_session_id).toBeNull();
  expect(spawn.calls).toBe(1);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("returns a live claim the daemon never saw receipted to the queue at boot", () => {
  const { supervisor } = makeSupervisor(fix, "live");
  const seeded = seedSteerableRun("claude");
  const row = appendRunContribution(fix.db, {
    id: "c-lost",
    run_id: RUN,
    step_run_id: seeded.stepRunId,
    body: "steer me",
  });
  const dir = sessionDir(fix.dataDir, RUN, seeded.agentSessionId);
  claimRunContributions(fix.db, [row.id], seeded.agentSessionId);
  appendLiveInput(dir, { id: row.id, body: row.body });

  supervisor.reconcile();

  // The worker died between the append and the write, so the message is waiting again — never delivered twice.
  expect(contributions()[0]).toMatchObject({
    status: "queued",
    agent_session_id: null,
    delivered_at: null,
  });
});

it("keeps a live claim the worker receipted delivered across a restart", () => {
  const { supervisor } = makeSupervisor(fix, "live");
  const seeded = seedSteerableRun("claude");
  const row = appendRunContribution(fix.db, {
    id: "c-written",
    run_id: RUN,
    step_run_id: seeded.stepRunId,
    body: "steer me",
  });
  const dir = sessionDir(fix.dataDir, RUN, seeded.agentSessionId);
  claimRunContributions(fix.db, [row.id], seeded.agentSessionId);
  appendLiveInput(dir, { id: row.id, body: row.body });
  createLiveInputChannel(dir).wrote(row.id, null);

  supervisor.reconcile();

  expect(contributions()[0]).toMatchObject({
    status: "delivered",
    agent_session_id: seeded.agentSessionId,
  });
});
