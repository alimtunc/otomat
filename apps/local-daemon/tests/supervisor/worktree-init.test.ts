import { getRun, updateRepositoryInitCommands } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

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

function logTexts(runId: string): string[] {
  return readRunEvents(fix.db, runId)
    .filter((event) => event.type === "runtime.log")
    .map((event) => (event.payload as { text?: string }).text ?? "");
}

it("runs init commands in the worktree, streams their output, then starts the first step", async () => {
  updateRepositoryInitCommands(fix.db, "repo-1", ["echo hello-from-init", "pwd"]);
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "with init" });
  expect(["queued", "preparing"]).toContain(run.status);

  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "review_ready")).toBe(true);
  expect(spawn.calls).toBe(1);

  const texts = logTexts(run.id);
  expect(texts).toContain("[otomat] worktree init: $ echo hello-from-init");
  expect(texts).toContain("hello-from-init");
  const pwdLine = texts.find((text) => text.includes("/worktrees/"));
  expect(pwdLine).toBeDefined();
});

it("fails the run honestly when an init command exits non-zero, never spawning the agent", async () => {
  updateRepositoryInitCommands(fix.db, "repo-1", ["echo before-failure", "exit 3"]);
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "failing init" });

  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "failed")).toBe(true);
  expect(spawn.calls).toBe(0);

  const texts = logTexts(run.id);
  expect(texts).toContain("before-failure");
  expect(texts.some((text) => text.includes("`exit 3` failed (exit 3)"))).toBe(true);
  const events = readRunEvents(fix.db, run.id);
  const terminal = events.find((event) => event.type === "run.lifecycle");
  expect(terminal?.payload).toMatchObject({ phase: "final", final_status: "failed" });
});

it("re-runs init on resume when the daemon died before any agent started", async () => {
  updateRepositoryInitCommands(fix.db, "repo-1", ["sleep 0.5", "echo second-command"]);
  const first = makeSupervisor(fix, "complete");

  const run = await first.supervisor.start({ prompt: "interrupted init" });
  expect(run.status).toBe("preparing");
  await first.supervisor.shutdown(0);
  expect(getRun(fix.db, run.id)?.status).toBe("preparing");
  expect(first.spawn.calls).toBe(0);

  const second = makeSupervisor(fix, "complete");
  second.supervisor.reconcile();
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");

  const resumed = await second.supervisor.resume(run.id);
  expect(resumed.status).toBe("preparing");
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "review_ready")).toBe(true);
  expect(second.spawn.calls).toBe(1);

  const texts = logTexts(run.id);
  expect(texts.filter((text) => text.includes("worktree init: $ sleep 0.5"))).toHaveLength(2);
  expect(texts).toContain("second-command");
});

it("launches immediately when the repository has no init commands", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "no init" });
  expect(run.status).toBe("running");
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "review_ready")).toBe(true);
  expect(logTexts(run.id).some((text) => text.includes("worktree init"))).toBe(false);
});
