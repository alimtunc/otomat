import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { listAgentSessionsForRun, schema } from "@otomat/db";
import { sessionContextSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { runGit } from "#git/git-cli";
import { findActiveByOwner } from "#git/worktrees-store";
import type { AppendStepInput } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const FOLLOW_UP: AppendStepInput = {
  name: "Address the review",
  note: "fix the comments",
  references: [],
  selector: { kind: "runtime", runtimeId: "fake" },
  overrides: {},
  dependsOn: [],
  replaces: null,
  origin: "review_fix",
};

/** Publishes a commit and rewinds the local branch, leaving `main` behind its remote. */
function advanceRemote(name: string): string {
  fix.repo.write(name, "published elsewhere\n");
  const sha = fix.repo.commitAll(`remote adds ${name}`);
  fix.repo.git("push", "--quiet", "origin", "main:refs/heads/main");
  fix.repo.git("reset", "--hard", "HEAD~1");
  return sha;
}

function diffBase(runId: string): string | undefined {
  const resolver = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  return resolver.forRun(runId)?.service.diff(runId).base;
}

it("forks a new run from the remote head when the local base branch is behind", async () => {
  const published = advanceRemote("remote-only.md");
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "build it" });
  await supervisor.settle();

  expect(findActiveByOwner(fix.db, run.id)?.base_sha).toBe(published);
  expect(existsSync(join(spawn.jobs[0]?.worktreePath ?? "", "remote-only.md"))).toBe(true);
});

it("ignores a local base branch that is ahead, dirty or left on another branch", async () => {
  fix.repo.write("local-only.md", "never published\n");
  fix.repo.commitAll("local work");
  writeFileSync(join(fix.repo.root, "scratch.md"), "work in progress\n");
  fix.repo.git("checkout", "-b", "side");
  const remoteHead = fix.repo.git("rev-parse", "origin/main").trim();
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "build it", base_branch: "main" });
  await supervisor.settle();

  expect(findActiveByOwner(fix.db, run.id)?.base_sha).toBe(remoteHead);
  expect(existsSync(join(spawn.jobs[0]?.worktreePath ?? "", "local-only.md"))).toBe(false);
  expect(fix.repo.git("status", "--porcelain")).toContain("scratch.md");
  expect(fix.repo.git("rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("side");
});

it("refuses the launch when the remote cannot be read instead of using a stale local base", async () => {
  advanceRemote("remote-only.md");
  fix.repo.git("remote", "set-url", "origin", join(fix.repo.root, "..", "gone.git"));
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(supervisor.start({ prompt: "build it" })).rejects.toMatchObject({
    name: "LaunchRefusedError",
    code: "base_remote_unavailable",
  });
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
});

it("refuses a repository with no remote until the launch asks for the local base explicitly", async () => {
  fix.cleanup();
  fix = setupDaemonDb({ withoutRemote: true });
  const localHead = fix.repo.git("rev-parse", "main").trim();
  const { supervisor } = makeSupervisor(fix, "complete");

  await expect(supervisor.start({ prompt: "build it" })).rejects.toMatchObject({
    name: "LaunchRefusedError",
    code: "base_remote_unavailable",
  });

  const run = await supervisor.start({ prompt: "build it", local_base: true });
  await supervisor.settle();

  expect(findActiveByOwner(fix.db, run.id)?.base_sha).toBe(localHead);
});

it("keeps a follow-up step in the cycle's own worktree and base after the remote moves on", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "build it" });
  await supervisor.settle();
  const launched = findActiveByOwner(fix.db, run.id);

  advanceRemote("moved-after-launch.md");
  await supervisor.appendStep(run.id, FOLLOW_UP);
  await supervisor.settle();

  expect(spawn.jobs[1]?.worktreePath).toBe(spawn.jobs[0]?.worktreePath);
  expect(findActiveByOwner(fix.db, run.id)?.base_sha).toBe(launched?.base_sha);
  expect(existsSync(join(spawn.jobs[1]?.worktreePath ?? "", "moved-after-launch.md"))).toBe(false);
});

it("measures the run's diff against the base it recorded, not the local branch", async () => {
  const published = advanceRemote("remote-only.md");
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "build it" });
  await supervisor.settle();
  writeFileSync(join(spawn.jobs[0]?.worktreePath ?? "", "agent.md"), "agent work\n");

  expect(diffBase(run.id)).toBe(published);
});

it("gives the agent context the same base the diff reads, not the lagging local branch", async () => {
  advanceRemote("remote-only.md");
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "build it" });
  await supervisor.settle();
  const worktree = spawn.jobs[0]?.worktreePath ?? "";
  writeFileSync(join(worktree, "agent.md"), "agent work\n");
  runGit(["add", "-A"], { cwd: worktree });
  runGit(["commit", "-m", "agent commit"], { cwd: worktree });

  await supervisor.appendStep(run.id, FOLLOW_UP);
  await supervisor.settle();

  const context = sessionContextSchema.parse(
    listAgentSessionsForRun(fix.db, run.id).at(-1)?.context_json,
  );
  expect(context.workspace?.commits).toEqual(["agent commit"]);
});
