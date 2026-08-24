import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRun,
  getStepRun,
  listAgentSessionsForRun,
  listRunInteractions,
  schema,
  type RunInteractionRow,
} from "@otomat/db";
import type { RuntimeInteractionAnswer } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents, sessionDir } from "#events";
import { RunInteractionRefusedError, type Supervisor } from "#supervisor";
import { ingestRunInteractions } from "#supervisor/interaction/ingest";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { seedWorkflowRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const RUN = "r-ask";
const STEP = "s-ask";

function seedAskingRun() {
  return seedWorkflowRun(fix.db, {
    runId: RUN,
    runStatus: "awaiting_human",
    steps: [
      {
        id: STEP,
        agent: "claude",
        status: "awaiting_human",
        session: { status: "awaiting_input", providerSessionId: `ps-${STEP}` },
      },
    ],
  })(STEP);
}

function interactions(runId = RUN): RunInteractionRow[] {
  return listRunInteractions(fix.db, runId);
}

/** The live session id, which is the turn the worker actually started rather than the seeded one. */
function liveSessionId(): string {
  const session = listAgentSessionsForRun(fix.db, RUN).findLast(
    (candidate) => candidate.status === "active",
  );
  if (!session) throw new Error(`run ${RUN} has no live session`);
  return session.id;
}

function inboxLines(runId: string, agentSessionId: string): Record<string, unknown>[] {
  const path = join(sessionDir(fix.dataDir, runId, agentSessionId), "live-input.jsonl");
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

/** Resumes the run onto a worker that asks one permission, and waits until the daemon has promoted it to a row. */
async function askingTurn(supervisor: Supervisor): Promise<RunInteractionRow> {
  await supervisor.resume(RUN);
  await waitFor(() => interactions().length === 1);
  const row = interactions()[0];
  if (!row) throw new Error("expected the question to become a durable row");
  return row;
}

const ALLOW: RuntimeInteractionAnswer = { kind: "permission", decision: "allow" };
const DENY: RuntimeInteractionAnswer = { kind: "permission", decision: "deny" };

it("promotes a question the turn asked into a pending row and rests the run on it", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();

  const row = await askingTurn(supervisor);

  expect(row).toMatchObject({
    run_id: RUN,
    step_run_id: STEP,
    provider_request_id: "ask-1",
    kind: "permission",
    state: "pending",
    prompt: "Run Write: notes.md",
    tool: "Write",
  });
  expect(await waitFor(() => getRun(fix.db, RUN)?.status === "awaiting_permission")).toBe(true);
  expect(getStepRun(fix.db, STEP)?.status).toBe("awaiting_permission");

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("reads the same question twice as one row, so a repeated pass never asks again", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);

  ingestRunInteractions(fix.db, RUN);
  ingestRunInteractions(fix.db, RUN);

  expect(interactions().map((entry) => entry.id)).toEqual([row.id]);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("hands the answer to the running turn exactly once and returns the run to work", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);
  const sessionId = liveSessionId();

  const answered = await supervisor.answerInteraction(RUN, row.id, ALLOW);

  expect(answered).toMatchObject({ state: "answered", answer_json: ALLOW });
  expect(inboxLines(RUN, sessionId)).toEqual([
    { kind: "interaction_answer", id: row.id, request_id: "ask-1", answer: ALLOW },
  ]);
  // No second turn was started to carry it: the answer joined the invocation already running.
  expect(spawn.calls).toBe(1);
  expect(getRun(fix.db, RUN)?.status).toBe("running");
  expect(getStepRun(fix.db, STEP)?.status).toBe("running");
  expect(
    readRunEvents(fix.db, RUN).filter((event) => event.type === "runtime.interaction_answered"),
  ).toHaveLength(1);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("answers the same question twice without sending the runtime a second answer", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);
  const sessionId = liveSessionId();

  await supervisor.answerInteraction(RUN, row.id, DENY);
  const repeated = await supervisor.answerInteraction(RUN, row.id, DENY);

  expect(repeated).toMatchObject({ state: "answered", answer_json: DENY });
  expect(inboxLines(RUN, sessionId)).toHaveLength(1);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("records one answer in the ledger even when two commands race for the same question", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);

  const [first, second] = await Promise.all([
    supervisor.answerInteraction(RUN, row.id, ALLOW),
    supervisor.answerInteraction(RUN, row.id, ALLOW),
  ]);

  expect(first).toMatchObject({ state: "answered" });
  expect(second).toMatchObject({ state: "answered" });
  expect(
    readRunEvents(fix.db, RUN).filter((event) => event.type === "runtime.interaction_answered"),
  ).toHaveLength(1);

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("refuses a second, different answer rather than letting the runtime hear both", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);
  await supervisor.answerInteraction(RUN, row.id, DENY);

  await expect(supervisor.answerInteraction(RUN, row.id, ALLOW)).rejects.toMatchObject({
    code: "run_interaction_answered",
  });

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("refuses an answer of the wrong kind for what the runtime asked", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);

  await expect(
    supervisor.answerInteraction(RUN, row.id, { kind: "text", text: "sure" }),
  ).rejects.toMatchObject({ code: "run_interaction_kind_mismatch" });
  expect(interactions()[0]?.state).toBe("pending");

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("ends a question whose turn is gone, and says so instead of accepting an answer", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  const row = await askingTurn(supervisor);

  await supervisor.abort(RUN);
  await supervisor.settle();

  expect(interactions()[0]).toMatchObject({ state: "canceled" });
  expect(interactions()[0]?.canceled_reason).toContain("ended");
  await expect(supervisor.answerInteraction(RUN, row.id, ALLOW)).rejects.toMatchObject({
    code: "run_interaction_unreachable",
  });
});

it("cancels a question left pending by a daemon that stopped, so no answer arrives late", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  await askingTurn(supervisor);
  // A restart loses every worker: the rows survive, the provider processes do not.
  const restarted = makeSupervisor(fix, "live-ask").supervisor;

  restarted.reconcile();

  expect(interactions()[0]).toMatchObject({ state: "canceled" });
  expect(getRun(fix.db, RUN)?.status).not.toBe("awaiting_permission");

  await supervisor.abort(RUN);
  await supervisor.settle();
});

it("keeps each run's questions to itself, and refuses one answered through another run", async () => {
  const { supervisor } = makeSupervisor(fix, "live-ask");
  seedAskingRun();
  // A second issue, because one issue owns a single workspace and would refuse the second run.
  fix.db
    .insert(schema.issues)
    .values({ id: "i-other", project_id: "p1", title: "Other", source: "local" })
    .run();
  seedWorkflowRun(fix.db, {
    runId: "r-other",
    issueId: "i-other",
    runStatus: "awaiting_human",
    steps: [{ id: "s-other", agent: "claude", status: "awaiting_human" }],
  })("s-other");
  const row = await askingTurn(supervisor);

  expect(interactions("r-other")).toEqual([]);
  await expect(supervisor.answerInteraction("r-other", row.id, ALLOW)).rejects.toBeInstanceOf(
    RunInteractionRefusedError,
  );
  expect(interactions()[0]?.state).toBe("pending");

  await supervisor.abort(RUN);
  await supervisor.settle();
});
