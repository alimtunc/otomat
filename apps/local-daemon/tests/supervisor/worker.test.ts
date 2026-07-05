import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { readEventsJsonl } from "#runtime";
import {
  parseJob,
  runWorkerJob,
  WORKER_JOB_ENV,
  writeTerminalMarker,
  type SupervisedJob,
} from "#supervisor";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-worker-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function job(mode: "run" | "resume", worktreePath: string | null = null): SupervisedJob {
  return {
    runId: "w1",
    stepRunId: "s1",
    agentSessionId: "a1",
    prompt: "do the thing",
    runDir: dir,
    worktreePath,
    mode,
    providerSessionId: mode === "resume" ? "ps-w1" : null,
  };
}

it("runs a job and appends a completed terminal marker", async () => {
  const j = job("run");
  const final = await runWorkerJob(j, new AbortController().signal);
  expect(final.status).toBe("completed");

  writeTerminalMarker(j, final, "2026-01-01T00:00:09.000Z");
  const events = readEventsJsonl(join(dir, "events.jsonl"));
  expect(events.some((e) => e.type === "runtime.provider_session")).toBe(true);
  expect(events.at(-1)?.type).toBe("run.lifecycle");
  expect(events.at(-1)?.payload["final_status"]).toBe("completed");
});

it("returns a canceled state when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  const final = await runWorkerJob(job("run"), controller.signal);
  expect(final.status).toBe("canceled");
});

it("parses a job from the environment, or null when absent", () => {
  const j = job("resume");
  expect(parseJob({ [WORKER_JOB_ENV]: JSON.stringify(j) })).toEqual(j);
  expect(parseJob({})).toBeNull();
});

it("writes a real file on a run turn and appends on a resume turn", async () => {
  const worktree = mkdtempSync(join(tmpdir(), "otomat-worktree-"));
  try {
    await runWorkerJob(job("run", worktree), new AbortController().signal);
    const file = join(worktree, "fake-implementation.md");
    const first = readFileSync(file, "utf8");
    expect(first).toContain("do the thing");

    await runWorkerJob(job("resume", worktree), new AbortController().signal);
    const second = readFileSync(file, "utf8");
    expect(second).toContain("Follow-up turn");
    expect(second.length).toBeGreaterThan(first.length);
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
});

it("leaves the filesystem untouched when the job has no worktree", async () => {
  await runWorkerJob(job("run"), new AbortController().signal);
  expect(existsSync(join(dir, "fake-implementation.md"))).toBe(false);
});
