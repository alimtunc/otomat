import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  claimRunContributions,
  getRun,
  listAgentSessionsForRun,
  listRunContributions,
  recordAgentSessionProcess,
  updateAgentSessionProvider,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { sessionDir } from "#events";
import { RunContributionNotRetriableError } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";
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

  const queued = await supervisor.contribute(run.id, "also add tests");

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

  await supervisor.contribute(run.id, "first message");
  await supervisor.contribute(run.id, "second message");
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
  expect(rows.every((entry) => entry.status === "completed")).toBe(true);
  expect(rows.every((entry) => entry.delivered_at !== null)).toBe(true);
});

it("delivers on the run's own provider session and worktree", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["slow", "complete"]);
  const run = await supervisor.start({ prompt: "do the work" });
  await supervisor.contribute(run.id, "keep going");
  await supervisor.settle();

  const [first, delivery] = spawn.jobs;
  expect(delivery?.agentSessionId).toBe(first?.agentSessionId);
  expect(delivery?.stepRunId).toBe(first?.stepRunId);
  expect(delivery?.worktreePath).toBe(first?.worktreePath);
  expect(delivery?.providerSessionId).toBe(`fake-session-${first?.agentSessionId}`);
});

it("delivers a lone message verbatim when the run is already resting", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "resting",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-resting",
  });

  const sent = await supervisor.contribute("resting", "Also add tests for the parser.");
  expect(sent.status).toBe("sent");
  expect(sent.delivered_at).not.toBeNull();
  expect(sent.attempts).toBe(1);
  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-resting",
    prompt: "Also add tests for the parser.",
  });

  await supervisor.settle();
  expect(contributions("resting")[0]?.status).toBe("completed");
});

it("fails a message the run cannot deliver and keeps it retriable", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "nosession",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: null,
  });

  const failed = await supervisor.contribute("nosession", "keep going");
  expect(failed.status).toBe("failed");
  expect(failed.delivered_at).toBeNull();
  expect(failed.error).toContain("no provider session");
  expect(spawn.calls).toBe(0);
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
  const failed = await supervisor.contribute("retry", "keep going");
  expect(failed.status).toBe("failed");

  updateAgentSessionProvider(fix.db, seeded.agentSessionId, "ps-retry");
  const retried = await supervisor.retryContribution("retry", failed.id);

  expect(retried.status).toBe("sent");
  expect(retried.attempts).toBe(1);
  expect(spawn.jobs[0]).toMatchObject({ mode: "resume", providerSessionId: "ps-retry" });
  await supervisor.settle();
});

it("refuses to retry a message the agent already received", async () => {
  const { supervisor } = makeSupervisor(fix, "fail");
  seedRun(fix.db, {
    runId: "delivered",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-delivered",
  });

  const sent = await supervisor.contribute("delivered", "keep going");
  expect(sent.status).toBe("sent");
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
  const queued = await first.supervisor.contribute(run.id, "queued before the crash");
  expect(queued.status).toBe("queued");

  const rebooted = makeSupervisor(fix, "complete");
  rebooted.supervisor.reconcile();

  expect(rebooted.spawn.calls).toBe(0);
  expect(contributions(run.id)[0]?.status).toBe("queued");

  await first.supervisor.abort(run.id);
  await first.supervisor.settle();
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

  const claimed = await supervisor.contribute("claimed", "carried by the lost worker");
  const dropped = await supervisor.contribute("unclaimed", "never handed over");
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

  await supervisor.contribute("turnfails", "keep going");
  await supervisor.settle();

  const row = contributions("turnfails")[0];
  expect(row?.status).toBe("failed");
  expect(row?.error).toContain("failed");
  expect(row?.delivered_at).not.toBeNull();
  expect(listAgentSessionsForRun(fix.db, "turnfails")).toHaveLength(1);
});
