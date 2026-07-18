import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listProjects, listRepositories } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { post, request } from "../support/api.js";
import { makeApiApp } from "../support/api.js";
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

it("registers a repository root as a project + repository pair", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/repositories", { path: repo.root });
  expect(res.status).toBe(201);

  const body = (await res.json()) as {
    project: { id: string; name: string; root_path: string };
    repository: { id: string; project_id: string; default_branch: string };
  };
  expect(body.project.root_path).toBe(realpathSync(repo.root));
  expect(body.repository.project_id).toBe(body.project.id);
  expect(body.repository.default_branch).toBe("main");

  expect(registeredProjects().map((p) => p.id)).toEqual([body.project.id]);
  expect(listRepositories(t.db, { projectId: body.project.id })).toHaveLength(1);

  const list = await request(app, "/api/repositories");
  const repositories = (await list.json()) as Array<{ id: string }>;
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
  expect(((await relative.json()) as { error: string }).error).toBe("path_not_absolute");

  const missing = await post(app, "/api/repositories", { path: join(scratch, "ghost") });
  expect(missing.status).toBe(400);
  expect(((await missing.json()) as { error: string }).error).toBe("path_not_found");
});

it("refuses a detached-HEAD repository", async () => {
  repo.git("checkout", "--detach", repo.git("rev-parse", "HEAD").trim());
  const res = await post(makeApiApp(t), "/api/repositories", { path: repo.root });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toBe("head_detached");
});

it("deduplicates the canonical root, including through a symlink", async () => {
  const app = makeApiApp(t);
  expect((await post(app, "/api/repositories", { path: repo.root })).status).toBe(201);

  const duplicate = await post(app, "/api/repositories", { path: repo.root });
  expect(duplicate.status).toBe(409);
  expect(((await duplicate.json()) as { error: string }).error).toBe(
    "repository_already_registered",
  );

  const link = join(scratch, "repo-link");
  symlinkSync(repo.root, link);
  const viaLink = await post(app, "/api/repositories", { path: link });
  expect(viaLink.status).toBe(409);

  expect(registeredProjects()).toHaveLength(1);
});
