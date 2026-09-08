import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvedAgentConfigSchema, WORKER_JOB_ENV } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readEventsJsonl } from "#runtime";
import { parseJob, runWorkerJob, writeTerminalMarker, type SupervisedJob } from "#supervisor";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "otomat-worker-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function job(mode: "run" | "resume", worktreePath = join(dir, "missing-worktree")): SupervisedJob {
  return {
    runId: "w1",
    stepRunId: "s1",
    agentSessionId: "a1",
    prompt: "do the thing",
    agentSessionDir: dir,
    worktreePath,
    runtime: "fake",
    config: null,
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

it("rejects a serialized job whose runtime is unknown to the registry", () => {
  const corrupted = { ...job("run"), runtime: "nope" };
  expect(() => parseJob({ [WORKER_JOB_ENV]: JSON.stringify(corrupted) })).toThrow(
    /unknown runtime/,
  );
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

it.each(["run", "resume"] as const)(
  "preserves both Codex permission settings when deserializing a %s job",
  (mode) => {
    const config = resolvedAgentConfigSchema.parse({
      runtime: "codex",
      profile_id: null,
      profile_name: null,
      options: { sandbox: "danger-full-access", approval_policy: "never" },
      guidance: null,
      skills: [],
      config_hash: "full",
    });
    const serialized = { ...job(mode), runtime: "codex", config };
    expect(parseJob({ [WORKER_JOB_ENV]: JSON.stringify(serialized) })).toEqual(serialized);
  },
);

it("writes a real file on a run turn and appends on a resume turn", async () => {
  const worktree = mkdtempSync(join(tmpdir(), "otomat-worktree-"));
  try {
    await runWorkerJob(job("run", worktree), new AbortController().signal);
    const file = join(worktree, "simulated-turn.md");
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

it("injects frozen skill provenance on a fresh session and keeps it out of the resume prompt", async () => {
  const worktree = mkdtempSync(join(tmpdir(), "otomat-worker-skill-"));
  const config = resolvedAgentConfigSchema.parse({
    runtime: "fake",
    profile_id: "profile",
    profile_name: "Implementation",
    options: {},
    guidance: "Follow the project guide",
    skills: [
      {
        id: "skill",
        name: "Guide",
        source: "user",
        canonical_path: "/unavailable/guide/SKILL.md",
        content_hash: "frozen",
        instructions: "Read references/constraints.md",
      },
    ],
    config_hash: "config",
  });
  try {
    await runWorkerJob({ ...job("run", worktree), config }, new AbortController().signal);
    const file = join(worktree, "simulated-turn.md");
    const first = readFileSync(file, "utf8");
    expect(first).toContain('Source (user): "/unavailable/guide/SKILL.md"');
    expect(first).toContain("Read references/constraints.md");

    await runWorkerJob({ ...job("resume", worktree), config }, new AbortController().signal);
    const followup = readFileSync(file, "utf8").slice(first.length);
    expect(followup).toContain("do the thing");
    expect(followup).not.toContain("Read references/constraints.md");
    expect(followup).not.toContain("Agent profile guidance");
  } finally {
    rmSync(worktree, { recursive: true, force: true });
  }
});

it("leaves the filesystem untouched when the job's worktree no longer exists", async () => {
  await runWorkerJob(job("run"), new AbortController().signal);
  expect(existsSync(join(dir, "simulated-turn.md"))).toBe(false);
});

it("rejects a serialized job that carries no worktree", () => {
  const { worktreePath: _dropped, ...withoutWorktree } = job("run");
  expect(() => parseJob({ [WORKER_JOB_ENV]: JSON.stringify(withoutWorktree) })).toThrow(
    /worktreePath/,
  );
});
