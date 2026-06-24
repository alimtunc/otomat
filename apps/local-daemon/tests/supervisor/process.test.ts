import { expect, it } from "vitest";

import { isProcessAlive, killProcessGroup } from "#supervisor";

import { deadPid, spawnOrphan, waitFor } from "../support/supervisor.js";

it("reports the current process as alive", () => {
  expect(isProcessAlive(process.pid)).toBe(true);
});

it("reports a finished process as dead", async () => {
  expect(isProcessAlive(await deadPid())).toBe(false);
});

it("kills a detached process group", async () => {
  const orphan = spawnOrphan();
  expect(isProcessAlive(orphan.pid)).toBe(true);
  killProcessGroup(orphan.pgid, "SIGKILL");
  expect(await waitFor(() => !isProcessAlive(orphan.pid))).toBe(true);
  orphan.stop();
});

it("ignores a signal to a non-existent group", () => {
  expect(() => killProcessGroup(2_000_000, "SIGTERM")).not.toThrow();
});

it("treats non-positive and init pids as not-alive (never probes pid<=1)", () => {
  expect(isProcessAlive(-1)).toBe(false);
  expect(isProcessAlive(0)).toBe(false);
  expect(isProcessAlive(1)).toBe(false);
});

it("never signals a non-positive process group (no PID 1 / broadcast)", () => {
  for (const pgid of [-1, 0, 1]) {
    expect(() => killProcessGroup(pgid, "SIGKILL")).not.toThrow();
  }
});
