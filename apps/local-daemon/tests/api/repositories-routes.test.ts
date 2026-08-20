import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getIssue,
  getRun,
  getWorkflowPreset,
  insertReview,
  insertReviewedFile,
  listProjects,
  listRepositories,
} from "@otomat/db";
import {
  projectContractSchema,
  registerRepositoryResponseSchema,
  repositoryBranchesResponseSchema,
  repositoryContractSchema,
  repositoryFilesResponseSchema,
  repositoryRegistrationErrorSchema,
  type RegisterRepositoryRequest,
} from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it } from "vitest";

import { del, json, makeApiApp, patch, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";

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
  const body: RegisterRepositoryRequest = { path };
  if (projectId !== undefined) body.project_id = projectId;
  const res = await post(app, "/api/repositories", body);
  expect(res.status).toBe(201);
  return registerRepositoryResponseSchema.parse(await res.json());
}

async function listRepos(app: Hono, projectId: string) {
  const res = await request(app, `/api/repositories?projectId=${projectId}`);
  return repositoryContractSchema.array().parse(await res.json());
}

it("marks only projects holding a repository, so the switcher can hide bootstrap ghosts", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);

  const res = await request(app, "/api/projects");
  const projects = projectContractSchema.array().parse(await res.json());

  expect(projects.find((project) => project.id === created.project.id)?.has_repository).toBe(true);
  expect(projects.find((project) => project.id === "p1")?.has_repository).toBe(false);
});

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
  expect(await json<{ error: string }>(gone)).toMatchObject({
    error: "repository_unavailable",
  });
});

it("searches tracked files for the context picker, capping and counting what it holds back", async () => {
  const app = makeApiApp(t);
  repo.write("src/parser.ts", "x\n");
  repo.write("src/writer.ts", "y\n");
  repo.write("docs/guide.md", "z\n");
  repo.commitAll("fixtures");
  const created = await registerRepo(app, repo.root);

  const matched = await request(app, `/api/repositories/${created.repository.id}/files?q=SRC/`);
  expect(matched.status).toBe(200);
  expect(repositoryFilesResponseSchema.parse(await matched.json())).toEqual({
    paths: ["src/parser.ts", "src/writer.ts"],
    omitted: 0,
  });

  const none = await request(app, `/api/repositories/${created.repository.id}/files?q=ghost`);
  expect(repositoryFilesResponseSchema.parse(await none.json()).paths).toEqual([]);

  expect((await request(app, "/api/repositories/nope/files")).status).toBe(404);

  rmSync(repo.root, { recursive: true, force: true });
  const gone = await request(app, `/api/repositories/${created.repository.id}/files`);
  expect(gone.status).toBe(409);
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

it("deletes an idle repository with its runs, reviewed marks and owning project", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  seedRun(t.db, {
    runId: "r-del",
    repositoryId: created.repository.id,
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  insertReview(t.db, { id: "rv-del", subject_id: "r-del", status: "in_review" });
  insertReviewedFile(t.db, {
    id: "rf-del",
    review_id: "rv-del",
    file_path: "src/thing.ts",
    diff_sha: "sha-1",
    reviewed: true,
  });

  const res = await del(app, `/api/repositories/${created.repository.id}`);
  expect(res.status).toBe(204);

  expect(listRepositories(t.db, { projectId: created.project.id })).toHaveLength(0);
  expect(registeredProjects()).toHaveLength(0);
  expect(getRun(t.db, "r-del")).toBeUndefined();
  expect(getIssue(t.db, "i1")).toBeDefined();
});

it("removes the project's workflow presets with its last repository", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  const scoped = await json<{ id: string }>(
    await post(app, "/api/workflow-presets", {
      scope: "project",
      project_id: created.project.id,
      name: "Ship it",
      plan: { version: 1, steps: [] },
    }),
  );
  const global = await json<{ id: string }>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Everywhere",
      plan: { version: 1, steps: [] },
    }),
  );

  expect((await del(app, `/api/repositories/${created.repository.id}`)).status).toBe(204);
  expect(getWorkflowPreset(t.db, scoped.id)).toBeUndefined();
  expect(getWorkflowPreset(t.db, global.id)).toBeDefined();
});

it("refuses to delete a repository while one of its runs is active", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  seedRun(t.db, {
    runId: "r-live",
    repositoryId: created.repository.id,
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  const res = await del(app, `/api/repositories/${created.repository.id}`);
  expect(res.status).toBe(409);
  expect(await json<{ error: string }>(res)).toMatchObject({
    error: "repository_has_active_runs",
  });
  expect(listRepositories(t.db, { projectId: created.project.id })).toHaveLength(1);
});

it("refuses deletion while an active run reaches the project through one of its issues", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  const issueRes = await post(app, "/api/issues", {
    project_id: created.project.id,
    title: "Moved into this project",
  });
  expect(issueRes.status).toBe(201);
  const issue = await json<{ id: string }>(issueRes);
  seedRun(t.db, {
    runId: "r-linked",
    issueId: issue.id,
    repositoryId: null,
    runStatus: "running",
    stepStatus: "running",
    sessionStatus: "active",
  });

  const res = await del(app, `/api/repositories/${created.repository.id}`);
  expect(res.status).toBe(409);
  expect(await json<{ error: string }>(res)).toMatchObject({
    error: "repository_has_active_runs",
  });
  expect(getRun(t.db, "r-linked")).toBeDefined();
});

it("reports an unknown repository deletion as not found", async () => {
  const app = makeApiApp(t);
  expect((await del(app, "/api/repositories/nope")).status).toBe(404);
});

it("stores worktree init commands per repository and serves them back", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);
  expect(created.repository.init_commands).toEqual([]);

  const res = await patch(app, `/api/repositories/${created.repository.id}`, {
    init_commands: ["pnpm install", "pnpm build"],
  });
  expect(res.status).toBe(200);
  expect(repositoryContractSchema.parse(await res.json()).init_commands).toEqual([
    "pnpm install",
    "pnpm build",
  ]);

  const listed = await listRepos(app, created.project.id);
  expect(listed[0]?.init_commands).toEqual(["pnpm install", "pnpm build"]);
});

it("rejects blank init commands and unknown repositories", async () => {
  const app = makeApiApp(t);
  const created = await registerRepo(app, repo.root);

  const blank = await patch(app, `/api/repositories/${created.repository.id}`, {
    init_commands: ["  "],
  });
  expect(blank.status).toBe(400);

  const missing = await patch(app, "/api/repositories/nope", { init_commands: [] });
  expect(missing.status).toBe(404);
});
