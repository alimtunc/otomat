import type { RunDetail, StepProviderWait } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ProviderResumeRefusedError } from "#supervisor";

import { json, makeApiApp, post, stubSupervisor } from "../support/api.js";
import { seedRepository, setupTestDb, type TestDb } from "../support/db.js";
import { seedRun } from "../support/seed.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-provider-wait-api-");
  seedRepository(t.db);
});

afterEach(() => {
  t.cleanup();
});

const FUTURE = "2100-01-01T00:00:00.000Z";

const WAIT: StepProviderWait = {
  provider: "claude",
  reason: "Claude AI usage limit reached|4102444800",
  detected_at: "2026-08-19T12:00:00.000Z",
  provider_resume_at: FUTURE,
  resume_at: FUTURE,
};

function seedWaitingRun(): void {
  seedRun(t.db, {
    runId: "r1",
    runStatus: "waiting_for_provider",
    stepStatus: "waiting_for_provider",
    sessionStatus: "idle",
    providerSessionId: "ps-1",
    providerWait: WAIT,
  });
}

it("answers a schedule change with the run, wait included, so the cockpit needs no second read", async () => {
  seedWaitingRun();
  const scheduleProviderResume = vi.fn();
  const app = makeApiApp(t, { supervisor: stubSupervisor({ scheduleProviderResume }) });

  const response = await post(app, "/api/runs/r1/provider-wait", { resume_at: FUTURE });

  expect(response.status).toBe(200);
  expect(scheduleProviderResume).toHaveBeenCalledWith("r1", FUTURE);
  const detail = await json<RunDetail>(response);
  expect(detail.steps[0]?.provider_wait).toEqual(WAIT);
});

it("takes a cleared schedule as the cancellation it is", async () => {
  seedWaitingRun();
  const scheduleProviderResume = vi.fn();
  const app = makeApiApp(t, { supervisor: stubSupervisor({ scheduleProviderResume }) });

  const response = await post(app, "/api/runs/r1/provider-wait", { resume_at: null });

  expect(response.status).toBe(200);
  expect(scheduleProviderResume).toHaveBeenCalledWith("r1", null);
});

it("serves the daemon's own refusal verbatim as a conflict", async () => {
  seedWaitingRun();
  const app = makeApiApp(t, {
    supervisor: stubSupervisor({
      scheduleProviderResume: () => {
        throw new ProviderResumeRefusedError("resume_at_passed", "That time has already passed.");
      },
    }),
  });

  const response = await post(app, "/api/runs/r1/provider-wait", { resume_at: FUTURE });

  expect(response.status).toBe(409);
  expect(await json(response)).toEqual({
    error: "resume_at_passed",
    message: "That time has already passed.",
  });
});

it("rejects a body that names no instant at all, rather than guessing one", async () => {
  seedWaitingRun();
  const app = makeApiApp(t, { supervisor: stubSupervisor() });

  const response = await post(app, "/api/runs/r1/provider-wait", { resume_at: "tomorrow" });

  expect(response.status).toBe(400);
});

it("hides the stored wait once the step is no longer waiting on it", async () => {
  seedRun(t.db, {
    runId: "r2",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
    providerSessionId: "ps-2",
    providerWait: WAIT,
  });
  const app = makeApiApp(t, { supervisor: stubSupervisor() });

  const detail = await json<RunDetail>(await post(app, "/api/runs/r2/abort", {}));

  expect(detail.steps[0]?.provider_wait).toBeNull();
});
