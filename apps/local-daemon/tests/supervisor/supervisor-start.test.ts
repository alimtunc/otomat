import { getRun, listAgentSessionsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { expectContiguousSeqs } from "../support/run-event-fixtures.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("runs a fake turn to completion in a real child process", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "implement the thing" });
  expect(run.status).toBe("running");

  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  const session = listAgentSessionsForRun(fix.db, run.id)[0];
  expect(session?.pid).toBeTypeOf("number");
  expect(session?.exit_code).toBe(0);

  const events = readRunEvents(fix.db, run.id);
  expect(events.length).toBeGreaterThan(0);
  expectContiguousSeqs(events);
  expect(events.some((e) => e.type === "run.lifecycle")).toBe(true);
});

it("runs a simple parallel group under the concurrency limit", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete", { concurrency: 2 });

  const runs = await Promise.all([
    supervisor.start({ prompt: "a" }),
    supervisor.start({ prompt: "b" }),
    supervisor.start({ prompt: "c" }),
  ]);
  await supervisor.settle();

  expect(spawn.calls).toBe(3);
  for (const run of runs) expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});
