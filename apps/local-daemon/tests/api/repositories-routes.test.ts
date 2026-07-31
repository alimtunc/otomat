import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listProjects, listRepositories } from "@otomat/db";
import {
  registerRepositoryResponseSchema,
  repositoryBranchesResponseSchema,
  repositoryContractSchema,
  repositoryRegistrationErrorSchema,
} from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";

let t: TestDb;
let repo: TestRepo;
let scratch: string;

beforeEach(() => {
  t = setupTestDb("otomat-repo-routes-");
  repo = setupTestRepo();
  scratch = mkdtempSync(join(tmpdir(), "otomat-repo-routes-scratch-"));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
  repo.cleanup();
  t.cleanup();
});

function registeredProjects() {
  return listProjects(t.db).filter((project) => project.id !== "p1");
}

async function registerRepo(app: Hono, path: string, projectId?: string) {
  const res = await post(app, "/api/repositories", {
    path,
    ...(projectId === undefined ? {} : { project_id: projectId }),
  });
  expect(res.status).toBe(201);
  return registerRepositoryResponseSchema.parse(await res.json());
}

async function listRepos(app: Hono, projectId: string) {
  const res = await request(app, `/api/repositories?projectId=${projectId}`);
  return repositoryContractSchema.array().parse(await res.json());
}

it("registers a repository root as a project + repository pair", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/repositories", { path: repo.root });
  expect(res.status).toBe(201);

  const body = registerRepositoryResponseSchema.parse(await res.json());
  expect(body.project.root_path).toBe(realpathSync(repo.root));
  expect(body.repository.project_id).toBe(body.project.id);
  expect(body.repository.default_branch).toBe("main");

  expect(registeredProjects().map((p) => p.id)).toEqual([body.project.id]);
  expect(listRepositories(t.db, { projectId: body.project.id })).toHaveLength(1);

  const list = await request(app, "/api/repositories");
  const repositories = repositoryContractSchema.array().parse(await list.json());
  expect(repositories.map((r) => r.id)).toContain(body.repository.id);
});

it("refuses a non-git directory with a stable code and writes nothing", async () => {
  const plain = join(scratch, "plain");
  mkdirSync(plain);
  const res = await post(makeApiApp(t), "/api/repositories", { path: plain });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({
    error: "path_not_git_repository",
    message: "This directory is not a git repository.",
  });
  expect(registeredProjects()).toHaveLength(0);
});

it("refuses a relative path and a missing path", async () => {
  const app = makeApiApp(t);
  const relative = await post(app, "/api/repositories", { path: "relative/repo" });
  expect(relative.status).toBe(400);
  expect(repositoryRegistrationErrorSchema.parse(await relative.json()).error).toBe(
    "path_not_absolute",
  );

  const missing = await post(app, "/api/repositories", { path: join(scratch, "ghost") });
  expect(missing.status).toBe(400);
  expect(repositoryRegistrationErrorSchema.parse(await missing.json()).error).toBe(
    "path_not_found",
  );
});

it("refuses a detached-HEAD repository", async () => {
  repo.git("checkout", "--detach", repo.git("rev-parse", "HEAD").trim());
  const res = await post(makeApiApp(t), "/api/repositories", { path: repo.root });
  expect(res.status).toBe(400);
  expect(repositoryRegistrationErrorSchema.parse(await res.json()).error).toBe("head_detached");
});

it("deduplicates the canonical root, including through a symlink", async () => {
  const app = makeApiApp(t);
  expect((await post(app, "/api/repositories", { path: repo.root })).status).toBe(201);

  const duplicate = await post(app, "/api/repositories", { path: repo.root });
  expect(duplicate.status).toBe(409);
  expect(repositoryRegistrationErrorSchema.parse(await duplicate.json()).error).toBe(
    "repository_already_registered",
  );

  const link = join(scratch, "repo-link");
  symlinkSync(repo.root, link);
  const viaLink = await post(app, "/api/repositories", { path: link });
  expect(viaLink.status).toBe(409);

  expect(registeredProjects()).toHaveLength(1);
});

it("attaches a repository to an existing repository-less project and anchors its root", async () => {
  const body = await registerRepo(makeApiApp(t), repo.root, "p1");
  expect(body.project.id).toBe("p1");
  expect(body.project.root_path).toBe(realpathSync(repo.root));
  expect(listRepositories(t.db, { projectId: "p1" })).toHaveLength(1);
  expect(registeredProjects()).toHaveLength(0);
});

it("refuses to attach a second repository to a project, and to attach to an unknown project", async () => {
  const app = makeApiApp(t);
  await registerRepo(app, repo.root, "p1");

  const second = setupTestRepo();
  try {
    const duplicate = await post(app, "/api/repositories", {
      path: second.root,
      project_id: "p1",
    });
    expect(duplicate.status).toBe(409);
    expect(repositoryRegistrationErrorSchema.parse(await duplicate.json()).error).toBe(
      "project_already_has_repository",
    );

    const ghost = await post(app, "/api/repositories", {
      path: second.root,
      project_id: "no-such-project",
    });
    expect(ghost.status).toBe(400);
    expect(repositoryRegistrationErrorSchema.parse(await ghost.json()).error).toBe(
      "project_not_found",
    );
  } finally {
    second.cleanup();
  }
});

it("reports a repository whose root vanished as unavailable instead of hiding it", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);

  expect((await listRepos(app, created.project.id))[0]?.available).toBe(true);

  rmSync(repo.root, { recursive: true, force: true });
  expect((await listRepos(app, created.project.id))[0]?.available).toBe(false);
});

it("lists the repository's branches most-recently-committed first, and refuses when its root is gone", async () => {
  const app = makeApiApp(t);
  // `zeta` sorts after `main` alphabetically and commits later, so only a date sort yields this order.
  repo.git("checkout", "-b", "zeta");
  repo.write("feature.txt", "x\n");
  repo.commitAllAt("zeta work", "2030-01-01T00:00:00Z");
  repo.git("checkout", "main");
  const created = await registerRepo(app, repo.root);

  const res = await request(app, `/api/repositories/${created.repository.id}/branches`);
  expect(res.status).toBe(200);
  const listed = repositoryBranchesResponseSchema.parse(await res.json());
  expect(listed.default_branch).toBe("main");
  expect(listed.branches).toEqual(["zeta", "main"]);

  const unknown = await request(app, "/api/repositories/nope/branches");
  expect(unknown.status).toBe(404);

  rmSync(repo.root, { recursive: true, force: true });
  const gone = await request(app, `/api/repositories/${created.repository.id}/branches`);
  expect(gone.status).toBe(409);
  expect((await gone.json()) as { error: string }).toMatchObject({
    error: "repository_unavailable",
  });
});

it("repairs a project whose registered repository moved, instead of refusing the only offered fix", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  rmSync(repo.root, { recursive: true, force: true });
  expect((await listRepos(app, created.project.id))[0]?.available).toBe(false);

  const moved = setupTestRepo();
  try {
    const repaired = await registerRepo(app, moved.root, created.project.id);
    expect(repaired.repository.id).toBe(created.repository.id);
    expect(repaired.project.root_path).toBe(realpathSync(moved.root));
    expect(listRepositories(t.db, { projectId: created.project.id })).toHaveLength(1);

    expect((await listRepos(app, created.project.id))[0]?.available).toBe(true);
  } finally {
    moved.cleanup();
  }
});

it("keeps reporting a detached-HEAD repository as available, since a launch forks from a branch", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  repo.git("checkout", "--detach", repo.git("rev-parse", "HEAD").trim());

  expect((await listRepos(app, created.project.id))[0]?.available).toBe(true);
  expect((await request(app, `/api/repositories/${created.repository.id}/branches`)).status).toBe(
    200,
  );
});
