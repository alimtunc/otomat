import {
  getRun,
  getStepRun,
  listStepRunsForRun,
  markRunAbandoned,
  schema,
  type StepRunRow,
} from "@otomat/db";
import type { StepProviderWait } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { recordProviderWait } from "#supervisor/provider-wait/record";

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

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2100-01-01T00:00:00.000Z";

function wait(overrides: Partial<StepProviderWait> = {}): StepProviderWait {
  return {
    provider: "fake",
    reason: "fake usage limit reached",
    detected_at: "2026-08-19T12:00:00.000Z",
    provider_resume_at: PAST,
    resume_at: PAST,
    ...overrides,
  };
}

function firstStep(runId: string): StepRunRow {
  const [step] = listStepRunsForRun(fix.db, runId);
  if (!step) throw new Error(`run ${runId} has no step`);
  return step;
}

function phases(runId: string): unknown[] {
  return readRunEvents(fix.db, runId)
    .filter((event) => event.type === "run.lifecycle")
    .map((event) => event.payload["phase"]);
}

it("suspends the run and its step on a quota, scheduled at the reset the provider proved", async () => {
  const { supervisor } = makeSupervisor(fix, "quota");

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("waiting_for_provider");
  // Nothing is stamped as finished: the work is owed, not over.
  expect(getRun(fix.db, run.id)?.completed_at).toBeNull();
  const step = firstStep(run.id);
  expect(step.status).toBe("waiting_for_provider");
  expect(step.provider_wait_json?.provider).toBe("fake");
  expect(step.provider_wait_json?.resume_at).toBe(step.provider_wait_json?.provider_resume_at);
  expect(step.provider_wait_json?.resume_at).not.toBeNull();
  expect(phases(run.id)).toContain("provider_wait");
});

it("leaves an unproved wait actionable, and takes a schedule and its cancellation", async () => {
  const { supervisor } = makeSupervisor(fix, "quota-undated");

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  const detected = firstStep(run.id).provider_wait_json;
  expect(detected?.provider_resume_at).toBeNull();
  expect(detected?.resume_at).toBeNull();

  supervisor.scheduleProviderResume(run.id, FUTURE);
  expect(firstStep(run.id).provider_wait_json?.resume_at).toBe(FUTURE);

  supervisor.scheduleProviderResume(run.id, null);
  const cancelled = firstStep(run.id);
  // Cancelling a schedule is not abandoning the work: the step still waits, and still says why.
  expect(cancelled.status).toBe("waiting_for_provider");
  expect(cancelled.provider_wait_json?.resume_at).toBeNull();
  expect(cancelled.provider_wait_json?.reason).toBe("fake usage limit reached");
});

// A reset the provider printed is kept as evidence whatever its age; only a future one becomes a schedule.
it("keeps a reset already behind us as evidence without scheduling anything on it", () => {
  const seeded = seedRun(fix.db, {
    runId: "rstale",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-stale",
  });

  const recorded = recordProviderWait(
    fix.db,
    fix.dataDir,
    { runId: "rstale", stepRunId: seeded.stepRunId, agentSessionId: seeded.agentSessionId },
    { provider: "claude", reason: "usage limit reached", resume_at: PAST },
    "2026-08-19T12:00:00.000Z",
  );

  expect(recorded.provider_resume_at).toBe(PAST);
  expect(recorded.resume_at).toBeNull();
});

it("refuses a schedule in the past and one on a run that is not waiting", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  expect(() => supervisor.scheduleProviderResume(run.id, PAST)).toThrow(
    expect.objectContaining({ name: "ProviderResumeRefusedError", code: "resume_at_passed" }),
  );
  expect(() => supervisor.scheduleProviderResume(run.id, FUTURE)).toThrow(
    expect.objectContaining({ name: "ProviderResumeRefusedError", code: "run_not_waiting" }),
  );
});

it("refuses a schedule the sweep would never honour, on a run that moved on to a winner", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rselect",
    runStatus: "awaiting_selection",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-select",
    providerWait: wait({ resume_at: null }),
  });

  expect(() => supervisor.scheduleProviderResume("rselect", FUTURE)).toThrow(
    expect.objectContaining({ name: "ProviderResumeRefusedError", code: "run_not_waiting" }),
  );
});

it("resumes the same run, step, session and worktree once the deadline has passed", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "rq",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-rq",
    providerWait: wait(),
  });

  expect(await supervisor.resumeDueProviderWaits()).toBe(1);
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(1);
  expect(spawn.jobs[0]).toMatchObject({
    mode: "resume",
    providerSessionId: "ps-rq",
    stepRunId: seeded.stepRunId,
  });
  expect(getRun(fix.db, "rq")?.status).toBe("review_ready");
  // No second branch and no second worktree row: the resume walked back into the one the run already owned.
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
  expect(phases("rq")).toContain("provider_resume");
});

it("leaves a wait alone until its deadline, and one with no schedule at all", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rlater",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-later",
    providerWait: wait({ provider_resume_at: FUTURE, resume_at: FUTURE }),
  });
  seedRun(fix.db, {
    runId: "rnosched",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-unscheduled",
    providerWait: wait({ provider_resume_at: null, resume_at: null }),
  });

  expect(await supervisor.resumeDueProviderWaits()).toBe(0);

  expect(spawn.calls).toBe(0);
  expect(getRun(fix.db, "rlater")?.status).toBe("waiting_for_provider");
  expect(getRun(fix.db, "rnosched")?.status).toBe("waiting_for_provider");
});

it("refuses a due resume whose workspace closed, and drops the schedule rather than retrying", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "rgone",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-gone",
    providerWait: wait(),
  });
  markRunAbandoned(fix.db, "rgone", "2026-08-19T13:00:00.000Z");

  expect(await supervisor.resumeDueProviderWaits()).toBe(0);
  expect(await supervisor.resumeDueProviderWaits()).toBe(0);

  expect(spawn.calls).toBe(0);
  expect(getStepRun(fix.db, seeded.stepRunId)?.provider_wait_json?.resume_at).toBeNull();
  const refused = readRunEvents(fix.db, "rgone").filter(
    (event) => event.payload["phase"] === "provider_resume",
  );
  expect(refused).toHaveLength(1);
  expect(refused[0]?.payload["outcome"]).toBe("refused");
});

it("keeps a due schedule while launches are held, instead of dropping it as a refusal", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "rheld",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-held",
    providerWait: wait(),
  });
  supervisor.setLaunchHold(true);

  expect(await supervisor.resumeDueProviderWaits()).toBe(0);
  expect(spawn.calls).toBe(0);
  expect(getStepRun(fix.db, seeded.stepRunId)?.provider_wait_json?.resume_at).toBe(PAST);

  supervisor.setLaunchHold(false);
  expect(await supervisor.resumeDueProviderWaits()).toBe(1);
  await supervisor.settle();
  expect(getRun(fix.db, "rheld")?.status).toBe("review_ready");
});

it("cancelling the run cancels the wait, so nothing resumes behind the operator's back", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedRun(fix.db, {
    runId: "rcancel",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-cancel",
    providerWait: wait(),
  });

  await supervisor.abort("rcancel");

  expect(getRun(fix.db, "rcancel")?.status).toBe("canceled");
  expect(getStepRun(fix.db, seeded.stepRunId)?.status).toBe("canceled");
  expect(await supervisor.resumeDueProviderWaits()).toBe(0);
  expect(spawn.calls).toBe(0);
});

it("survives a restart without losing or duplicating the scheduled resume", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedRun(fix.db, {
    runId: "rboot",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-boot",
    providerWait: wait(),
  });

  // Boot reconciliation must leave a waiting run exactly as it found it.
  expect(supervisor.reconcile().reconciled).toHaveLength(0);
  expect(getRun(fix.db, "rboot")?.status).toBe("waiting_for_provider");

  const [first, second] = await Promise.all([
    supervisor.resumeDueProviderWaits(),
    supervisor.resumeDueProviderWaits(),
  ]);
  await supervisor.settle();

  expect(first + second).toBe(1);
  expect(spawn.calls).toBe(1);
});
