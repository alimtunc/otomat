import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getProject, getRepository, listRepositories, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { registerLocalRepository } from "#api/repository-registration";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_REPOSITORY_ID,
  ensureDefaultProject,
  ensureDefaultRepository,
} from "#bootstrap";

import { setupTestDb, type TestDb } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";

let t: TestDb;
let repo: TestRepo;
let scratch: string;

beforeEach(() => {
  t = setupTestDb("otomat-bootstrap-");
  repo = setupTestRepo();
  scratch = mkdtempSync(join(tmpdir(), "otomat-bootstrap-scratch-"));
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
  repo.cleanup();
  t.cleanup();
});

it("creates the default project on a canonical root and re-anchors it while it owns no repository", () => {
  const link = join(scratch, "root-link");
  symlinkSync(repo.root, link);

  expect(ensureDefaultProject(t.db, link)).toBe(DEFAULT_PROJECT_ID);
  expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(repo.root));

  expect(ensureDefaultProject(t.db, scratch)).toBe(DEFAULT_PROJECT_ID);
  expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(scratch));
});

it("freezes the default project's root once it owns a repository, whatever the boot root is", () => {
  // The production order: the boot also materializes the repository, which binds the root.
  ensureDefaultRepository(t.db, ensureDefaultProject(t.db, repo.root));
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)).toBeDefined();

  const elsewhere = setupTestRepo();
  try {
    expect(ensureDefaultProject(t.db, elsewhere.root)).toBe(DEFAULT_PROJECT_ID);
    expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(repo.root));
  } finally {
    elsewhere.cleanup();
  }
});

it("keeps a repository registered onto the default project when the daemon reboots", () => {
  // The user booted outside a git repository, then registered one through the blocked launch.
  ensureDefaultRepository(t.db, ensureDefaultProject(t.db, scratch));
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)).toBeUndefined();

  const registered = registerLocalRepository(t.db, repo.root, DEFAULT_PROJECT_ID);
  expect(registered.ok).toBe(true);

  expect(ensureDefaultProject(t.db, scratch)).toBe(DEFAULT_PROJECT_ID);
  expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(repo.root));
});

it("reuses a registered project owning the boot root instead of creating the default one", () => {
  t.db
    .insert(schema.projects)
    .values({ id: "registered", name: "R", root_path: realpathSync(repo.root) })
    .run();

  expect(ensureDefaultProject(t.db, repo.root)).toBe("registered");
  expect(getProject(t.db, DEFAULT_PROJECT_ID)).toBeUndefined();
});

it("creates the default repository row with the detected branch and refreshes it across boots", () => {
  const projectId = ensureDefaultProject(t.db, repo.root);
  ensureDefaultRepository(t.db, projectId);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)?.default_branch).toBe("main");

  repo.git("checkout", "-b", "trunk");
  ensureDefaultRepository(t.db, projectId);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)?.default_branch).toBe("trunk");
});

it("writes no repository row for a non-git boot root", () => {
  const projectId = ensureDefaultProject(t.db, scratch);
  ensureDefaultRepository(t.db, projectId);
  expect(listRepositories(t.db, { projectId })).toHaveLength(0);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)).toBeUndefined();
});

it("reuses the registered project's repository when booting from a registered root", () => {
  t.db
    .insert(schema.projects)
    .values({ id: "registered", name: "R", root_path: realpathSync(repo.root) })
    .run();
  t.db
    .insert(schema.repositories)
    .values({ id: "registered-repo", project_id: "registered", name: "R", default_branch: "main" })
    .run();

  const projectId = ensureDefaultProject(t.db, repo.root);
  expect(projectId).toBe("registered");
  ensureDefaultRepository(t.db, projectId);
  expect(listRepositories(t.db, { projectId }).map((row) => row.id)).toEqual(["registered-repo"]);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)).toBeUndefined();

  repo.git("checkout", "-b", "trunk");
  ensureDefaultRepository(t.db, projectId);
  expect(getRepository(t.db, "registered-repo")?.default_branch).toBe("trunk");
});
