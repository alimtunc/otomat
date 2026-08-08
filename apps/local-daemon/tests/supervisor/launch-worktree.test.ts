import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { schema, updateIssueProject } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { registerLocalRepository } from "#api/repository-registration";
import {
  createRepositoryResolver,
  GitCommandError,
  type AcquireWorktreeInput,
  type GitWorktreeService,
  type RepositoryResolver,
} from "#git";
import { findActiveByOwner } from "#git/worktrees-store";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { branches, setupTestRepo } from "../support/git.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const TWO_STEP_PLAN = {
  version: 1 as const,
  steps: [
    { id: "s1", name: "Plan", agent: null, prompt: "plan it", depends_on: [] },
    { id: "s2", name: "Build", agent: null, prompt: "build it", depends_on: ["s1"] },
  ],
};

const COMPETE_PLAN = {
  version: 1 as const,
  steps: [
    {
      id: "approach",
      name: "Choose",
      depends_on: [],
      compete: [
        { id: "direct", name: "Direct", agent: null, prompt: "direct" },
        { id: "layered", name: "Layered", agent: null, prompt: "layered" },
      ],
    },
  ],
};

function seedProject(id: string, rootPath: string, repositoryId?: string): void {
  fix.db.insert(schema.projects).values({ id, name: id, root_path: rootPath }).run();
  if (repositoryId !== undefined) {
    fix.db
      .insert(schema.repositories)
      .values({ id: repositoryId, project_id: id, name: id, default_branch: "main" })
      .run();
  }
}

/** Mirrors a merge: the run lands terminal and gives its worktree back, closing the issue's workspace. */
function closeWorkspace(runId: string): void {
  fix.db
    .update(schema.worktrees)
    .set({ status: "removed" })
    .where(eq(schema.worktrees.owner_token, runId))
    .run();
  fix.db.update(schema.runs).set({ status: "completed" }).where(eq(schema.runs.id, runId)).run();
}

it("gives a single ad-hoc run its own worktree on a dedicated branch, never the user's checkout", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  const job = spawn.jobs[0];
  expect(job?.worktreePath).toBeTruthy();
  expect(existsSync(job?.worktreePath ?? "")).toBe(true);
  // The one guarantee the runtime relies on: it never receives the main checkout.
  expect(job?.worktreePath).not.toBe(fix.repo.root);
  expect(branches(fix.repo)).toContain(run.branch);
  expect(run.worktree_id).not.toBeNull();
});

it("runs every step of a workflow in the run's single canonical worktree", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);

  const run = await supervisor.start({ prompt: "the goal", plan: TWO_STEP_PLAN });
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(2);
  const paths = new Set(spawn.jobs.map((job) => job.worktreePath));
  expect(paths.size).toBe(1);
  expect(existsSync([...paths][0] ?? "")).toBe(true);
  expect(findActiveByOwner(fix.db, run.id)?.branch).toBe(run.branch);
});

it("launches a local issue in its own project's repository", async () => {
  fix.db
    .insert(schema.issues)
    .values({ id: "i-local", project_id: "p1", title: "Local issue", status: "ready" })
    .run();
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ issue_id: "i-local" });
  await supervisor.settle();

  expect(run.repository_id).toBe(fix.repositoryId);
  expect(existsSync(spawn.jobs[0]?.worktreePath ?? "")).toBe(true);
});

it("launches a synced issue in the project its tracker source is bound to", async () => {
  const other = setupTestRepo();
  try {
    seedProject("p-linear", other.root, "r-linear");
    fix.db
      .insert(schema.issues)
      .values({
        id: "i-linear",
        project_id: "p-linear",
        title: "Synced issue",
        status: "ready",
        source: "linear",
        source_external_id: "lin-1",
        source_identifier: "OTO-1",
        synced_at: "2026-07-29T00:00:00.000Z",
      })
      .run();
    const { supervisor, spawn } = makeSupervisor(fix, "complete");

    const run = await supervisor.start({ issue_id: "i-linear" });
    await supervisor.settle();

    expect(run.repository_id).toBe("r-linear");
    expect(branches(other)).toContain(run.branch);
    expect(branches(fix.repo)).not.toContain(run.branch);
    expect(existsSync(spawn.jobs[0]?.worktreePath ?? "")).toBe(true);
  } finally {
    other.cleanup();
  }
});

it("follows the issue to its new project once the issue is moved", async () => {
  const moved = setupTestRepo();
  try {
    seedProject("p-moved", moved.root, "r-moved");
    fix.db
      .insert(schema.issues)
      .values({ id: "i-move", project_id: "p1", title: "Moves", status: "ready" })
      .run();
    const { supervisor } = makeSupervisor(fix, ["complete", "complete"]);

    const before = await supervisor.start({ issue_id: "i-move" });
    await supervisor.settle();
    expect(before.repository_id).toBe(fix.repositoryId);

    // The issue only takes a second launch once its first workspace is closed.
    closeWorkspace(before.id);
    updateIssueProject(fix.db, "i-move", "p-moved");
    const after = await supervisor.start({ issue_id: "i-move" });
    await supervisor.settle();

    expect(after.repository_id).toBe("r-moved");
    expect(branches(moved)).toContain(after.branch);
    expect(branches(fix.repo)).not.toContain(after.branch);
  } finally {
    moved.cleanup();
  }
});

it("refuses an explicit project that disagrees with the issue's own project", async () => {
  const other = setupTestRepo();
  try {
    seedProject("p-other", other.root, "r-other");
    fix.db
      .insert(schema.issues)
      .values({ id: "i-pinned", project_id: "p1", title: "Pinned", status: "ready" })
      .run();
    const { supervisor, spawn } = makeSupervisor(fix, "complete");

    await expect(
      supervisor.start({ issue_id: "i-pinned", project_id: "p-other" }),
    ).rejects.toMatchObject({ name: "LaunchRefusedError", code: "project_mismatch" });
    expect(spawn.calls).toBe(0);
    expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  } finally {
    other.cleanup();
  }
});

it("refuses a launch whose project has no repository, before any row or spawn", async () => {
  seedProject("p-norepo", "/tmp/otomat-project-without-repository");
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "nowhere to work", project_id: "p-norepo" }),
  ).rejects.toMatchObject({ name: "LaunchRefusedError", code: "repository_required" });
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.issues).all()).toHaveLength(1);
});

it("refuses a launch whose registered repository is gone from disk", async () => {
  const doomed = setupTestRepo();
  seedProject("p-gone", doomed.root, "r-gone");
  rmSync(doomed.root, { recursive: true, force: true });
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "vanished repo", project_id: "p-gone" }),
  ).rejects.toMatchObject({ name: "LaunchRefusedError", code: "repository_unavailable" });
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
});

it("refuses an unknown base branch, leaving no run, issue or worktree behind", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  await expect(
    supervisor.start({ prompt: "fork from nowhere", base_branch: "does-not-exist" }),
  ).rejects.toMatchObject({ name: "LaunchRefusedError", code: "base_branch_not_found" });
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.issues).all()).toHaveLength(1);
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(0);
});

it("forks the run's worktree from the requested base branch, not the default one", async () => {
  fix.repo.git("checkout", "-b", "develop");
  fix.repo.write("only-on-develop.txt", "feature\n");
  const developHead = fix.repo.commitAll("develop work");
  fix.repo.git("checkout", "main");
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "continue the feature", base_branch: "develop" });
  await supervisor.settle();

  const worktreePath = spawn.jobs[0]?.worktreePath ?? "";
  expect(existsSync(`${worktreePath}/only-on-develop.txt`)).toBe(true);
  const worktree = findActiveByOwner(fix.db, run.id);
  expect(worktree?.base_sha).toBe(developHead);
  expect(worktree?.base_ref).toBe("develop");
});

it("defaults the fork point to the repository's default branch when none is requested", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "default base" });
  await supervisor.settle();

  const worktree = findActiveByOwner(fix.db, run.id);
  expect(worktree?.base_ref).toBe(fix.repo.defaultBranch);
  expect(worktree?.base_sha).toBe(fix.repo.git("rev-parse", fix.repo.defaultBranch).trim());
});

/** A resolver whose `acquire` is `decorate`d, to drive the launch's failure handling. */
function resolverAcquiring(
  decorate: (real: GitWorktreeService["acquire"]) => GitWorktreeService["acquire"],
): RepositoryResolver {
  const resolver = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const binding = resolver.forRepository(fix.repositoryId);
  if (!binding) throw new Error("expected a repository binding");
  const wrapped: RepositoryResolver = {
    forRepository: () => ({
      ...binding,
      service: { ...binding.service, acquire: decorate(binding.service.acquire) },
    }),
    forProject: () => wrapped.forRepository(fix.repositoryId),
    forRun: () => wrapped.forRepository(fix.repositoryId),
  };
  return wrapped;
}

/** A resolver whose `acquire` throws for the inputs `shouldFail` selects. */
function resolverFailingWith(
  error: Error,
  shouldFail: (input: AcquireWorktreeInput) => boolean = () => true,
): RepositoryResolver {
  return resolverAcquiring((real) => (input) => {
    if (shouldFail(input)) throw error;
    return real(input);
  });
}

it("turns a git-level worktree failure into a refusal, writing no run and no issue", async () => {
  const gitFailure = new GitCommandError(
    ["worktree", "add"],
    fix.repo.root,
    128,
    "fatal: could not create work tree dir",
  );
  const { supervisor, spawn } = makeSupervisor(fix, "complete", {
    repositories: resolverFailingWith(gitFailure),
  });

  await expect(supervisor.start({ prompt: "doomed" })).rejects.toMatchObject({
    name: "LaunchRefusedError",
    code: "worktree_unavailable",
    cause: gitFailure,
  });
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.issues).all()).toHaveLength(1);
});

it("refuses with the reason when the worktrees directory cannot be created", async () => {
  // A file where the worktrees root must go: the daemon's own data dir is unusable.
  const blocker = join(fix.dataDir, "blocker");
  writeFileSync(blocker, "");
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(blocker, "worktrees"),
  });
  const { supervisor, spawn } = makeSupervisor(fix, "complete", { repositories });

  await expect(supervisor.start({ prompt: "nowhere to put it" })).rejects.toMatchObject({
    name: "LaunchRefusedError",
    code: "worktree_unavailable",
    // The path the user has to fix must reach them, not just the daemon log.
    message: expect.stringMatching(/ENOTDIR|EEXIST/),
  });
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
});

it("lets a non-git acquire failure surface as itself rather than a launch refusal", async () => {
  const bug = new TypeError("cannot read properties of undefined");
  const { supervisor, spawn } = makeSupervisor(fix, "complete", {
    repositories: resolverFailingWith(bug),
  });

  await expect(supervisor.start({ prompt: "doomed" })).rejects.toBe(bug);
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
});

it("launches right after a repository is registered onto a previously repo-less project", async () => {
  const late = setupTestRepo();
  try {
    seedProject("p-late", "/tmp/otomat-project-not-yet-registered");
    const { supervisor, spawn } = makeSupervisor(fix, "complete");

    await expect(
      supervisor.start({ prompt: "too early", project_id: "p-late" }),
    ).rejects.toMatchObject({ code: "repository_required" });

    // The launch must see the registration immediately — a boot-time verdict would strand the user.
    const registered = registerLocalRepository(fix.db, late.root, "p-late");
    expect(registered.ok).toBe(true);

    const run = await supervisor.start({ prompt: "now it works", project_id: "p-late" });
    await supervisor.settle();

    expect(existsSync(spawn.jobs[0]?.worktreePath ?? "")).toBe(true);
    expect(branches(late)).toContain(run.branch);
  } finally {
    late.cleanup();
  }
});

it("launches from a repository whose HEAD is detached, forking from an explicit branch", async () => {
  fix.repo.git("checkout", "--detach", fix.repo.git("rev-parse", "HEAD").trim());
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "detached is fine", base_branch: "main" });
  await supervisor.settle();

  expect(existsSync(spawn.jobs[0]?.worktreePath ?? "")).toBe(true);
  expect(findActiveByOwner(fix.db, run.id)?.base_ref).toBe("main");
});

it("writes no session when a compete group cannot acquire every competitor worktree", async () => {
  const diskFull = Object.assign(new Error("ENOSPC: no space left on device, mkdir"), {
    syscall: "mkdir",
  });
  // Competitor ids are minted at freeze time, so the failing one is selected by rank:
  // the run's own worktree and the first competitor succeed, the second competitor fails.
  let competitors = 0;
  const { supervisor, spawn } = makeSupervisor(fix, "complete", {
    repositories: resolverFailingWith(diskFull, (input) => {
      if (!input.branch.includes("--compete-")) return false;
      competitors += 1;
      return competitors > 1;
    }),
  });
  await expect(supervisor.start({ prompt: "compete", plan: COMPETE_PLAN })).rejects.toBe(diskFull);
  await supervisor.settle();

  expect(spawn.calls).toBe(0);
  // A session on a step of a now-failed group is a state no boot pass can settle.
  expect(fix.db.select().from(schema.agentSessions).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.competeGroups).all()[0]?.status).toBe("failed");
  expect(branches(fix.repo).filter((name) => name.includes("--compete-"))).toEqual([]);
  expect(
    fix.db
      .select()
      .from(schema.worktrees)
      .all()
      .filter((row) => row.status === "active" && row.branch.includes("--compete-")),
  ).toEqual([]);
  const { supervisor: rebooted } = makeSupervisor(fix, "complete");
  expect(() => rebooted.reconcile()).not.toThrow();
});

it("rolls a compete group back whole when writing its sessions fails", async () => {
  let competitors = 0;
  const { supervisor, spawn } = makeSupervisor(fix, "complete", {
    // The second competitor's worktree is real but reported under an id no row carries, so
    // attaching it violates the FK: it stands for any failure of the session-writing phase.
    repositories: resolverAcquiring((real) => (input) => {
      const worktree = real(input);
      if (!input.branch.includes("--compete-")) return worktree;
      competitors += 1;
      return competitors > 1 ? { ...worktree, id: "no-such-worktree" } : worktree;
    }),
  });

  await expect(supervisor.start({ prompt: "compete", plan: COMPETE_PLAN })).rejects.toThrow();
  await supervisor.settle();

  expect(spawn.calls).toBe(0);
  // The first competitor's session and worktree attachment must roll back with the group.
  expect(fix.db.select().from(schema.agentSessions).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.competeGroups).all()[0]?.status).toBe("failed");
  expect(branches(fix.repo).filter((name) => name.includes("--compete-"))).toEqual([]);
  const { supervisor: rebooted } = makeSupervisor(fix, "complete");
  expect(() => rebooted.reconcile()).not.toThrow();
});
