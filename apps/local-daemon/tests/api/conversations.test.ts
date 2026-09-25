import {
  appendRunContribution,
  insertAgentSession,
  recordRunInteraction,
  schema,
  updateAgentSessionStatus,
} from "@otomat/db";
import type { ConversationSnapshot } from "@otomat/domain";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RuntimeEvent } from "#runtime";

import { json, makeApiApp, post, request } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { appendEvents } from "../support/ledger.js";
import { makeEvent } from "../support/run-event-fixtures.js";
import { seedConfig, seedRun, seedWorkflowRun, type SeededRun } from "../support/seed.js";

let t: TestDb;

const SPOKE_AT = "2026-09-19T10:05:00.000Z";
const SPOKE_AGAIN_AT = "2026-09-19T10:09:00.000Z";

function message(
  seed: SeededRun,
  index: number,
  occurredAt: string,
  text: string,
  thinking = false,
): RuntimeEvent {
  const payload: RuntimeEvent["payload"] = {
    fidelity: "parsed",
    adapter: "claude",
    role: "assistant",
    text,
  };
  if (thinking) payload["thinking"] = true;
  return makeEvent(seed.runId, index, {
    step_run_id: seed.stepRunId,
    agent_session_id: seed.agentSessionId,
    type: "runtime.message",
    source: "claude",
    occurred_at: occurredAt,
    payload,
  });
}

/** Seeded rows are stamped now; the fixture messages must come after the step was created, not before. */
function backdateStep(stepRunId: string): void {
  t.db
    .update(schema.stepRuns)
    .set({ created_at: "2026-09-19 10:00:00", updated_at: "2026-09-19 10:00:00" })
    .where(eq(schema.stepRuns.id, stepRunId))
    .run();
}

async function readSnapshot(): Promise<ConversationSnapshot> {
  const response = await request(makeApiApp(t), "/api/conversations");
  expect(response.status).toBe(200);
  return json<ConversationSnapshot>(response);
}

beforeEach(() => {
  t = setupTestDb("otomat-conversations-");
});

afterEach(() => {
  t.cleanup();
});

describe("GET /api/conversations", () => {
  it("lists one thread per step that has a session, keyed by the step and carrying its participant", async () => {
    seedRun(t.db, {
      runId: "run-1",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });

    const snapshot = await readSnapshot();

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      id: "conversation:run-1-step",
      project: { id: "p1", name: "P" },
      issue: { id: "i1" },
      run_id: "run-1",
      step_run_id: "run-1-step",
      step_name: "Agent turn",
      step_status: "running",
      participant: { runtime: "fake", profile_name: null, model: null, effort: null },
      last: null,
      queued_contributions: 0,
      read: false,
      archived: false,
    });
  });

  it("skips a queued step nobody wrote to, but lists one holding a queued message", async () => {
    const lookup = seedWorkflowRun(t.db, {
      runId: "run-2",
      runStatus: "running",
      steps: [
        { id: "plan", status: "running", session: { status: "active" } },
        { id: "review", status: "queued" },
        { id: "docs", status: "queued" },
      ],
    });
    appendRunContribution(t.db, {
      id: "c-1",
      run_id: "run-2",
      step_run_id: lookup("review").stepRunId,
      body: "Check the anchors too.",
      images_json: [],
      target_agent_session_id: null,
      target_config_json: null,
    });

    const snapshot = await readSnapshot();

    expect(
      snapshot.entries
        .filter((entry) => "step_run_id" in entry)
        .map((entry) => entry.step_run_id)
        .toSorted(),
    ).toEqual(["plan", "review"]);
    const review = snapshot.entries.find(
      (entry) => "step_run_id" in entry && entry.step_run_id === "review",
    );
    expect(review).toMatchObject({
      participant: { runtime: "fake" },
      last: { kind: "user", text: "Check the anchors too." },
      queued_contributions: 1,
    });
  });

  it("reads the newest answer as the last line and ignores reasoning", async () => {
    const seed = seedRun(t.db, {
      runId: "run-3",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });
    backdateStep(seed.stepRunId);
    appendEvents(
      t.db,
      "run-3",
      [
        message(seed, 0, SPOKE_AT, "Root cause found."),
        message(seed, 1, SPOKE_AGAIN_AT, "Let me think…", true),
      ],
      0,
    );

    const [entry] = (await readSnapshot()).entries;

    if (!entry || !("last" in entry)) throw new Error("Missing cockpit thread");
    expect(entry.last).toEqual({ kind: "agent", text: "Root cause found.", at: SPOKE_AT });
    expect(entry?.updated_at).toBe(SPOKE_AT);
  });

  it("surfaces a pending question and keeps a mark only until the thread moves past it", async () => {
    const seed = seedRun(t.db, {
      runId: "run-4",
      runStatus: "awaiting_permission",
      stepStatus: "awaiting_permission",
      sessionStatus: "active",
    });
    backdateStep(seed.stepRunId);
    recordRunInteraction(t.db, {
      id: "q-1",
      run_id: "run-4",
      step_run_id: seed.stepRunId,
      agent_session_id: seed.agentSessionId,
      provider_request_id: "req-1",
      kind: "permission",
      prompt: "Run Bash(pnpm check)?",
      tool: "Bash",
      reason: null,
      questions_json: [],
      requested_at: SPOKE_AT,
    });
    const asked = (await readSnapshot()).entries[0];
    expect(asked).toMatchObject({
      pending_interaction: { kind: "permission", prompt: "Run Bash(pnpm check)?" },
      last: { kind: "interaction", text: "Run Bash(pnpm check)?" },
    });
    if (asked === undefined) throw new Error("no thread");

    const marked = await post(makeApiApp(t), "/api/inbox/marks", {
      marks: [
        { entry_id: asked.id, read: true, archived: false, evidence_updated_at: asked.updated_at },
      ],
    });
    expect(marked.status).toBe(200);
    expect((await readSnapshot()).entries[0]?.read).toBe(true);

    appendEvents(t.db, "run-4", [message(seed, 1, SPOKE_AGAIN_AT, "Done, all green.")], 0);
    expect((await readSnapshot()).entries[0]).toMatchObject({
      read: false,
      last: { kind: "agent", text: "Done, all green." },
    });
  });

  it("drops a settled run past the window and a closed issue's review, keeps a followed run at any age", async () => {
    seedRepository(t.db);
    t.db.insert(schema.issues).values({ id: "i2", project_id: "p1", title: "Two" }).run();
    t.db
      .insert(schema.issues)
      .values({ id: "i3", project_id: "p1", title: "Three", status: "done" })
      .run();
    seedRun(t.db, {
      runId: "run-old",
      runStatus: "completed",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    seedRun(t.db, {
      runId: "run-live",
      issueId: "i2",
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    seedRun(t.db, {
      runId: "run-closed",
      issueId: "i3",
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    for (const runId of ["run-old", "run-live", "run-closed"]) {
      t.db
        .update(schema.runs)
        .set({ updated_at: "2020-01-01 00:00:00" })
        .where(eq(schema.runs.id, runId))
        .run();
    }

    const snapshot = await readSnapshot();

    expect(
      snapshot.entries
        .filter((entry) => "run_id" in entry)
        .map((entry) => [entry.run_id, entry.issue.cycle]),
    ).toEqual([["run-live", "reviewing"]]);
  });

  it("stops following a thread on the read after its cycle closes", async () => {
    const seed = seedRun(t.db, {
      runId: "run-5",
      runStatus: "running",
      stepStatus: "running",
      sessionStatus: "active",
    });
    expect((await readSnapshot()).entries[0]?.issue?.cycle).toBe("running");

    t.db.update(schema.runs).set({ status: "completed" }).where(eq(schema.runs.id, "run-5")).run();
    t.db
      .update(schema.stepRuns)
      .set({ status: "succeeded" })
      .where(eq(schema.stepRuns.run_id, "run-5"))
      .run();
    updateAgentSessionStatus(t.db, seed.agentSessionId, "terminated");

    expect((await readSnapshot()).entries[0]).toMatchObject({
      step_status: "succeeded",
      issue: { cycle: null },
    });
  });

  it("reads a succeeded step as running while its next turn is live, and never from a supervision turn", async () => {
    const seed = seedRun(t.db, {
      runId: "run-6",
      runStatus: "running",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    insertAgentSession(t.db, { id: "run-6-turn", step_run_id: seed.stepRunId, status: "active" });
    insertAgentSession(t.db, {
      id: "run-6-supervision",
      step_run_id: seed.stepRunId,
      kind: "supervision",
      status: "terminated",
      config_json: seedConfig("run-6-supervision", "codex"),
    });
    expect((await readSnapshot()).entries[0]).toMatchObject({
      step_status: "running",
      participant: { runtime: "fake" },
    });

    updateAgentSessionStatus(t.db, "run-6-turn", "terminated");
    expect((await readSnapshot()).entries[0]).toMatchObject({ step_status: "succeeded" });
  });
});
