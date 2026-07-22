import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, expect, it } from "vitest";

import {
  createReexecSpawn,
  isProcessAlive,
  killProcessGroup,
  type SupervisedJob,
} from "#supervisor";

import { waitFor } from "../support/poll.js";
import { deadPid, spawnOrphan } from "../support/spawn.js";

const FAKE_WORKER = join(dirname(fileURLToPath(import.meta.url)), "../support/fake-worker.mjs");

let agentSessionDir = "";

beforeEach(() => {
  agentSessionDir = mkdtempSync(join(tmpdir(), "otomat-start-gate-"));
});

afterEach(() => {
  rmSync(agentSessionDir, { recursive: true, force: true });
});

function job(): SupervisedJob {
  return {
    runId: "run-gate",
    stepRunId: "step-gate",
    agentSessionId: "session-gate",
    prompt: "do not run before release",
    agentSessionDir,
    worktreePath: null,
    runtime: "fake",
    config: null,
    mode: "run",
    providerSessionId: null,
  };
}

it("does not let a re-exec worker emit events before the durable start release", async () => {
  const proc = createReexecSpawn(FAKE_WORKER)(job());
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(isProcessAlive(proc.pid)).toBe(true);
  expect(existsSync(join(agentSessionDir, "events.jsonl"))).toBe(false);

  proc.kill("SIGKILL");
  await proc.exited;
  expect(existsSync(join(agentSessionDir, "events.jsonl"))).toBe(false);
});

it("runs the worker after the parent releases its start gate", async () => {
  const proc = createReexecSpawn(FAKE_WORKER)(job());
  proc.start();
  await proc.exited;

  expect(existsSync(join(agentSessionDir, "events.jsonl"))).toBe(true);
});

it("reports the current process as alive", () => {
  expect(isProcessAlive(process.pid)).toBe(true);
});

it("reports a finished process as dead", async () => {
  expect(isProcessAlive(await deadPid())).toBe(false);
});

it("kills a detached process group", async () => {
  const orphan = spawnOrphan();
  try {
    expect(isProcessAlive(orphan.pid)).toBe(true);
    killProcessGroup(orphan.pgid, "SIGKILL");
    expect(await waitFor(() => !isProcessAlive(orphan.pid))).toBe(true);
  } finally {
    orphan.stop();
  }
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
