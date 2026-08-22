import {
  getRun,
  listAgentSessionsForRun,
  listRunContributions,
  listStepRunsForRun,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { StepStopRefusedError } from "#supervisor";

import { contributeToStep } from "../support/contribution.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { seedRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const TWO_STEPS = {
  version: 1 as const,
  steps: [
    { id: "implement", name: "Implement", agent: null, note: "build it", depends_on: [] },
    { id: "verify", name: "Verify", agent: null, note: "check it", depends_on: ["implement"] },
  ],
};

it("stops a live turn to a resumable interruption, holding its queue and its dependents", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "long task", plan: TWO_STEPS });
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "running")).toBe(true);
  const [implement] = listStepRunsForRun(fix.db, run.id);
  if (!implement) throw new Error("plan seeded no step");
  expect(
    await waitFor(() =>
      readRunEvents(fix.db, run.id).some((event) => event.type === "runtime.provider_session"),
    ),
  ).toBe(true);
  const queued = await contributeToStep(fix.db, supervisor, run.id, implement.id, "while running");
  expect(queued.status).toBe("queued");

  const stopped = await supervisor.stopStep(run.id, implement.id);

  expect(stopped.status).toBe("awaiting_human");
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  const session = listAgentSessionsForRun(fix.db, run.id)[0];
  expect(session?.status).toBe("awaiting_input");
  expect(session?.provider_session_id).toBe(`fake-session-${session?.id}`);
  // The interruption is neither delivery nor failure: the message waits for an explicit action.
  expect(listRunContributions(fix.db, run.id)[0]?.status).toBe("queued");
  expect(spawn.calls).toBe(1);

  await expect(supervisor.stopStep(run.id, implement.id)).rejects.toMatchObject({
    code: "step_not_active",
  });
});

it("resumes the same provider session and worktree on the next message, then chains dependents", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete", "complete"]);
  const run = await supervisor.start({ prompt: "long task", plan: TWO_STEPS });
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "running")).toBe(true);
  const [implement] = listStepRunsForRun(fix.db, run.id);
  if (!implement) throw new Error("plan seeded no step");
  expect(
    await waitFor(() =>
      readRunEvents(fix.db, run.id).some((event) => event.type === "runtime.provider_session"),
    ),
  ).toBe(true);
  await supervisor.stopStep(run.id, implement.id);
  const first = listAgentSessionsForRun(fix.db, run.id)[0];

  await contributeToStep(fix.db, supervisor, run.id, implement.id, "continue please");
  expect(await waitFor(() => spawn.calls >= 2)).toBe(true);
  await supervisor.settle();

  const resumeJob = spawn.jobs[1];
  expect(resumeJob?.mode).toBe("resume");
  expect(resumeJob?.providerSessionId).toBe(first?.provider_session_id);
  expect(resumeJob?.worktreePath).toBe(spawn.jobs[0]?.worktreePath);
  const sessions = listAgentSessionsForRun(fix.db, run.id).filter(
    (session) => session.step_run_id === implement.id,
  );
  expect(sessions.at(-1)?.resumed_from_session_id).toBe(first?.id);
  // Only the successful follow-up turn advances the plan; the stop itself started nothing.
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "succeeded",
  ]);
  expect(listRunContributions(fix.db, run.id)[0]?.status).toBe("acknowledged");
});

it("refuses to stop a settled or unknown step instead of faking an interruption", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "quick task" });
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  const [step] = listStepRunsForRun(fix.db, run.id);

  await expect(supervisor.stopStep(run.id, step?.id ?? "missing")).rejects.toMatchObject({
    code: "step_not_active",
  });
  await expect(supervisor.stopStep(run.id, "missing")).rejects.toBeInstanceOf(StepStopRefusedError);
});

it("refuses to stop an idle seeded step that has no live process", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  seedRun(fix.db, {
    runId: "r-idle",
    runStatus: "awaiting_human",
    stepStatus: "awaiting_human",
    sessionStatus: "awaiting_input",
    providerSessionId: "ps-idle",
  });
  const [step] = listStepRunsForRun(fix.db, "r-idle");

  await expect(supervisor.stopStep("r-idle", step?.id ?? "missing")).rejects.toMatchObject({
    code: "step_not_active",
  });
});
