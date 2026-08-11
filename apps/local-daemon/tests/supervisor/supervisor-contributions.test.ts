import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  appendRunContribution,
  claimRunContributions,
  getRun,
  listAgentSessionsForRun,
  listRunContributions,
  recordAgentSessionProcess,
  updateAgentSessionProvider,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { sessionDir } from "#events";
import {
  RunContributionNotCancelableError,
  RunContributionNotRetriableError,
  RunContributionStepClosedError,
} from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { firstStepOf, seedRun, seedWorkflowRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

function contributions(runId: string) {
  return listRunContributions(fix.db, runId);
}

it("persists a message sent during an active turn without claiming any delivery", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work" });

  const queued = await supervisor.contribute(run.id, firstStepOf(fix.db, run.id), "also add tests");

  expect(queued.status).toBe("queued");
  expect(queued.delivered_at).toBeNull();
  expect(queued.agent_session_id).toBeNull();
  expect(queued.attempts).toBe(0);
  expect(spawn.calls).toBe(1);
  expect(getRun(fix.db, run.id)?.status).toBe("running");

  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("batches the queued messages into the next turn in send order, keeping each one visible", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete"]);
  const run = await supervisor.start({ prompt: "do the work" });
  const step = firstStepOf(fix.db, run.id);

  await supervisor.contribute(run.id, step, "first message");
  await supervisor.contribute(run.id, step, "second message");
  expect(spawn.calls).toBe(1);
  expect(contributions(run.id).map((entry) => entry.status)).toEqual(["queued", "queued"]);

  await supervisor.settle();

  expect(spawn.calls).toBe(2);
  const delivery = spawn.jobs[1];
  expect(delivery?.mode).toBe("resume");
  expect(delivery?.prompt).toContain("--- Message 1 ---\nfirst message");
  expect(delivery?.prompt).toContain("--- Message 2 ---\nsecond message");
  expect(delivery?.prompt.indexOf("first message")).toBeLessThan(
    delivery?.prompt.indexOf("second message") ?? -1,
  );

  const rows = contributions(run.id);
  expect(rows.map((entry) => entry.seq)).toEqual([0, 1]);
  expect(rows.map((entry) => entry.body)).toEqual(["first message", "second message"]);
  expect(rows.every((entry) => entry.status === "acknowledged")).toBe(true);
  expect(rows.every((entry) => entry.delivered_at !== null)).toBe(true);
});

it("carries a message queued while the run waited for capacity into that step's first turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete"], { concurrency: 1 });
  const holder = await supervisor.start({ prompt: "hold the only slot" });
  const waiting = await supervisor.start({ prompt: "the real work" });

  // The second run owns its rows but has not spawned: its turn is still queued on the semaphore.
  expect(spawn.calls).toBe(1);
  const queued = await supervisor.contribute(
    waiting.id,
    firstStepOf(fix.db, waiting.id),
    "use fixtures",
  );
  expect(queued.status).toBe("queued");
  expect(getRun(fix.db, waiting.id)?.status).toBe("queued");

  await supervisor.abort(holder.id);
  await supervisor.settle();

  const started = spawn.jobs.find((job) => job.runId === waiting.id);
  expect(started?.mode).toBe("run");
  expect(started?.prompt).toContain("the real work");
  expect(started?.prompt).toContain("use fixtures");
  expect(contributions(waiting.id)[0]?.delivered_at).not.toBeNull();
});

it("delivers on the run's own provider session and worktree", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete"]);
  const run = await supervisor.start({ prompt: "do the work" });
  await supervisor.contribute(run.id, firstStepOf(fix.db, run.id), "keep going");
  await supervisor.settle();

  const [first, delivery] = spawn.jobs;
  expect(delivery?.agentSessionId).toBe(first?.agentSessionId);
  expect(delivery?.stepRunId).toBe(first?.stepRunId);
  expect(delivery?.worktreePath).toBe(first?.worktreePath);
  expect(delivery?.providerSessionId).toBe(`fake-session-${first?.agentSessionId}`);
});

it("delivers a lone message verbatim when the run is already resting", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "resting",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-resting",
  });

  const sent = await supervisor.contribute(
    "resting",
    seeded.stepRunId,
    "Also add tests for the parser.",
  );
  expect(sent.status).toBe("delivered");
  expect(sent.delivered_at).not.toBeNull();
  expect(sent.attempts).toBe(1);
  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-resting",
    prompt: "Also add tests for the parser.",
  });

  await supervisor.settle();
  expect(contributions("resting")[0]?.status).toBe("acknowledged");
});

it("refuses a message addressed to a step that will not run again", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  // A canceled step that never opened a session: no turn of it will ever exist.
  seedWorkflowRun(fix.db, {
    runId: "done",
    runStatus: "review_ready",
    steps: [{ id: "done-step", status: "canceled" }],
  });

  await expect(supervisor.contribute("done", "done-step", "one more thing")).rejects.toBeInstanceOf(
    RunContributionStepClosedError,
  );
  expect(contributions("done")).toEqual([]);
});

it("still takes a follow-up for a finished step, because resuming its session is the point", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "reviewed",
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
    providerSessionId: "ps-reviewed",
  });

  const sent = await supervisor.contribute(
    "reviewed",
    seeded.stepRunId,
    "address the review comments",
  );

  expect(sent.status).toBe("delivered");
  await supervisor.settle();
});

it("fails a message the run cannot deliver and keeps it retriable", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "nosession",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: null,
  });

  const failed = await supervisor.contribute("nosession", seeded.stepRunId, "keep going");
  expect(failed.status).toBe("failed");
  expect(failed.delivered_at).toBeNull();
  expect(failed.error).toContain("no provider session");
  expect(spawn.calls).toBe(0);
});

it("fails an unreachable step's batch and still delivers the step that can take one", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "mixed",
    runStatus: "awaiting_human",
    steps: [
      {
        id: "mixed-stuck",
        status: "awaiting_human",
        session: { status: "awaiting_input", providerSessionId: null },
      },
      {
        id: "mixed-live",
        status: "awaiting_human",
        session: { status: "awaiting_input", providerSessionId: "ps-live" },
      },
    ],
  });
  appendRunContribution(fix.db, {
    id: "c-stuck",
    run_id: "mixed",
    step_run_id: "mixed-stuck",
    body: "for the session that never reported",
  });
  appendRunContribution(fix.db, {
    id: "c-live",
    run_id: "mixed",
    step_run_id: "mixed-live",
    body: "for the resumable one",
  });

  await supervisor.deliverContributions("mixed");

  const byId = new Map(contributions("mixed").map((row) => [row.id, row]));
  expect(byId.get("c-stuck")?.status).toBe("failed");
  expect(byId.get("c-stuck")?.error).toContain("no provider session");
  expect(byId.get("c-live")?.status).toBe("delivered");
  expect(spawn.jobs[0]).toMatchObject({ mode: "resume", providerSessionId: "ps-live" });
  await supervisor.settle();
});

it("retries a failed message that never reached the provider", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "retry",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: null,
  });
  const failed = await supervisor.contribute("retry", seeded.stepRunId, "keep going");
  expect(failed.status).toBe("failed");

  updateAgentSessionProvider(fix.db, seeded.agentSessionId, "ps-retry");
  const retried = await supervisor.retryContribution("retry", failed.id);

  expect(retried.status).toBe("delivered");
  expect(retried.attempts).toBe(1);
  expect(spawn.jobs[0]).toMatchObject({ mode: "resume", providerSessionId: "ps-retry" });
  await supervisor.settle();
});

it("withdraws a message no turn has claimed, and refuses once one has", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "do the work" });
  const step = firstStepOf(fix.db, run.id);

  const queued = await supervisor.contribute(run.id, step, "never mind this one");
  const canceled = supervisor.cancelContribution(run.id, queued.id);
  expect(canceled.status).toBe("canceled");
  expect(canceled.delivered_at).toBeNull();

  const claimed = await supervisor.contribute(run.id, step, "this one is on its way");
  claimRunContributions(fix.db, [claimed.id], listAgentSessionsForRun(fix.db, run.id)[0]?.id ?? "");
  expect(() => supervisor.cancelContribution(run.id, claimed.id)).toThrowError(
    RunContributionNotCancelableError,
  );

  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("never carries a canceled message into a later turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete"]);
  const run = await supervisor.start({ prompt: "do the work" });
  const step = firstStepOf(fix.db, run.id);

  const dropped = await supervisor.contribute(run.id, step, "forget this");
  await supervisor.contribute(run.id, step, "but do this");
  supervisor.cancelContribution(run.id, dropped.id);

  await supervisor.settle();

  const delivery = spawn.jobs[1];
  expect(delivery?.prompt).toBe("but do this");
  expect(delivery?.prompt).not.toContain("forget this");
});

it("refuses to retry a message the agent already received", async () => {
  const { supervisor } = makeSupervisor(fix, "fail");
  const seeded = seedRun(fix.db, {
    runId: "delivered",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-delivered",
  });

  const sent = await supervisor.contribute("delivered", seeded.stepRunId, "keep going");
  expect(sent.status).toBe("delivered");
  await supervisor.settle();

  const settled = contributions("delivered")[0];
  expect(settled?.status).toBe("failed");
  expect(settled?.delivered_at).not.toBeNull();
  await expect(supervisor.retryContribution("delivered", sent.id)).rejects.toBeInstanceOf(
    RunContributionNotRetriableError,
  );
});

it("keeps a message queued across a restart and never spawns for it at boot", async () => {
  const first = makeSupervisor(fix, "linger");
  const run = await first.supervisor.start({ prompt: "do the work" });
  const queued = await first.supervisor.contribute(
    run.id,
    firstStepOf(fix.db, run.id),
    "queued before the crash",
  );
  expect(queued.status).toBe("queued");

  const rebooted = makeSupervisor(fix, "complete");
  rebooted.supervisor.reconcile();

  expect(rebooted.spawn.calls).toBe(0);
  expect(contributions(run.id)[0]?.status).toBe("queued");

  await first.supervisor.abort(run.id);
  await first.supervisor.settle();
});

it("replays a message a restart left queued exactly once", async () => {
  const seeded = seedRun(fix.db, {
    runId: "reconnected",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-reconnected",
  });
  // Persisted by the daemon that died before it could hand the message to a turn.
  appendRunContribution(fix.db, {
    id: "left-behind",
    run_id: "reconnected",
    step_run_id: seeded.stepRunId,
    body: "survive the restart",
  });

  const rebooted = makeSupervisor(fix, "complete");
  rebooted.supervisor.reconcile();
  expect(rebooted.spawn.calls).toBe(0);

  // Two flushes in a row: the replay hands the message to one turn, never two.
  await rebooted.supervisor.deliverContributions("reconnected");
  await rebooted.supervisor.deliverContributions("reconnected");
  await rebooted.supervisor.settle();

  const rows = contributions("reconnected");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: "left-behind", status: "acknowledged", attempts: 1 });
  expect(rebooted.spawn.calls).toBe(1);
  expect(rebooted.spawn.jobs[0]?.prompt).toBe("survive the restart");
});

it("treats a crash-time claim as delivered only when its worker was really launched", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const launched = seedRun(fix.db, {
    runId: "claimed",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    providerSessionId: "ps-claimed",
    pid: 4242,
    pgid: 4242,
  });
  const neverLaunched = seedRun(fix.db, {
    runId: "unclaimed",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    providerSessionId: "ps-unclaimed",
    // A resumable session always carries a pid from an earlier turn, so only the gate can tell the two apart.
    pid: 5353,
    pgid: 5353,
  });

  const claimed = await supervisor.contribute(
    "claimed",
    launched.stepRunId,
    "carried by the lost worker",
  );
  const dropped = await supervisor.contribute(
    "unclaimed",
    neverLaunched.stepRunId,
    "never handed over",
  );
  // Reproduces the claim a crash leaves behind: recorded session, still queued.
  claimRunContributions(fix.db, [claimed.id], launched.agentSessionId);
  claimRunContributions(fix.db, [dropped.id], neverLaunched.agentSessionId);
  // Only the launched worker took its start gate; the other never got one.
  const gateDir = sessionDir(fix.dataDir, "claimed", launched.agentSessionId);
  mkdirSync(gateDir, { recursive: true });
  writeFileSync(join(gateDir, `.worker-started-${randomUUID()}`), "ready");

  makeSupervisor(fix, "complete").supervisor.reconcile();

  // The lost worker did carry it, so boot settles it as a failed delivery — never back to `queued`,
  // which would let a retry replay an instruction the provider already saw.
  expect(contributions("claimed")[0]).toMatchObject({ status: "failed" });
  expect(contributions("claimed")[0]?.delivered_at).not.toBeNull();
  expect(contributions("unclaimed")[0]).toMatchObject({
    status: "queued",
    agent_session_id: null,
    delivered_at: null,
  });
});

it("marks delivered messages failed when the turn carrying them fails", async () => {
  const { supervisor } = makeSupervisor(fix, "fail");
  const seeded = seedRun(fix.db, {
    runId: "turnfails",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-turnfails",
  });
  recordAgentSessionProcess(fix.db, seeded.agentSessionId, { pid: 1, pgid: 1 });

  await supervisor.contribute("turnfails", seeded.stepRunId, "keep going");
  await supervisor.settle();

  const row = contributions("turnfails")[0];
  expect(row?.status).toBe("failed");
  expect(row?.error).toContain("failed");
  expect(row?.delivered_at).not.toBeNull();
  expect(listAgentSessionsForRun(fix.db, "turnfails")).toHaveLength(1);
});
