import { join } from "node:path";

import { schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver, type RepositoryResolver } from "#git/resolver";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { anchorProjectRoot, seedRepository } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";

let fix: DaemonTestDb;
let repo: TestRepo;
let resolver: RepositoryResolver;

beforeEach(() => {
  fix = setupDaemonDb();
  repo = setupTestRepo();
  seedRepository(fix.db, repo.defaultBranch);
  anchorProjectRoot(fix.db, repo.root);
  resolver = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
});

afterEach(() => {
  repo.cleanup();
  fix.cleanup();
});

it("resolves a repository id to a working service and caches the binding", () => {
  const binding = resolver.forRepository("repo-1");
  expect(binding?.repositoryId).toBe("repo-1");
  const worktree = binding?.service.acquire({ owner: "run-x", branch: "otomat/run/run-x" });
  expect(worktree?.branch).toBe("otomat/run/run-x");
  expect(resolver.forRepository("repo-1")).toBe(binding);
});

it("returns null for a null id, an unknown repository, and a project without repository", () => {
  expect(resolver.forRepository(null)).toBeNull();
  expect(resolver.forRepository("ghost")).toBeNull();
  fix.db.insert(schema.projects).values({ id: "p2", name: "P2", root_path: "/tmp/p2" }).run();
  expect(resolver.forProject("p2")).toBeNull();
});

it("resolves a project to its main repository", () => {
  expect(resolver.forProject("p1")?.repositoryId).toBe("repo-1");
});

it("resolves a run through its stamped repository_id, and to null without one", () => {
  seedRun(fix.db, {
    runId: "r-bound",
    repositoryId: "repo-1",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  seedRun(fix.db, {
    runId: "r-bare",
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });
  expect(resolver.forRun("r-bound")?.repositoryId).toBe("repo-1");
  expect(resolver.forRun("r-bare")).toBeNull();
  expect(resolver.forRun("ghost")).toBeNull();
});
