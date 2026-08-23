import { afterEach, beforeEach, expect, it } from "vitest";

import { LaunchRefusedError } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("accepts work until the hold is armed, and again once it is lifted", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  expect(supervisor.setLaunchHold(true)).toEqual({ held: true, active_runs: 0 });
  await expect(supervisor.start({ prompt: "one" })).rejects.toBeInstanceOf(LaunchRefusedError);

  expect(supervisor.setLaunchHold(false)).toEqual({ held: false, active_runs: 0 });
  const run = await supervisor.start({ prompt: "one" });
  expect(run.id).toBeTruthy();
  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("refuses with the code the API turns into a 409", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  supervisor.setLaunchHold(true);

  await expect(supervisor.start({ prompt: "one" })).rejects.toMatchObject({
    code: "launches_held",
  });
});

it("reports the runs still in flight, which is what the caller judges the install on", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ prompt: "one" });
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);

  expect(supervisor.setLaunchHold(true)).toEqual({ held: true, active_runs: 1 });

  supervisor.setLaunchHold(false);
  await supervisor.abort(run.id);
  await supervisor.settle();
  expect(supervisor.setLaunchHold(true).active_runs).toBe(0);
});

it("refuses to resume a stopped run while the hold is armed", async () => {
  const { supervisor } = makeSupervisor(fix, ["linger", "complete"]);
  const run = await supervisor.start({ prompt: "one" });
  await supervisor.abort(run.id);
  await supervisor.settle();

  supervisor.setLaunchHold(true);
  await expect(supervisor.resume(run.id)).rejects.toMatchObject({ code: "launches_held" });

  supervisor.setLaunchHold(false);
  await expect(supervisor.resume(run.id)).resolves.toBeTruthy();
  await supervisor.abort(run.id);
  await supervisor.settle();
});
