import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getProject, getRepository, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

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

it("creates the default project on a canonical root and re-anchors it when the boot root moves", () => {
  const link = join(scratch, "root-link");
  symlinkSync(repo.root, link);

  expect(ensureDefaultProject(t.db, link)).toBe(DEFAULT_PROJECT_ID);
  expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(repo.root));

  expect(ensureDefaultProject(t.db, scratch)).toBe(DEFAULT_PROJECT_ID);
  expect(getProject(t.db, DEFAULT_PROJECT_ID)?.root_path).toBe(realpathSync(scratch));
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
  expect(ensureDefaultRepository(t.db, projectId, repo.root)).toBe(DEFAULT_REPOSITORY_ID);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)?.default_branch).toBe("main");

  repo.git("checkout", "-b", "trunk");
  expect(ensureDefaultRepository(t.db, projectId, repo.root)).toBe(DEFAULT_REPOSITORY_ID);
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)?.default_branch).toBe("trunk");
});

it("returns null for a non-git boot root", () => {
  const projectId = ensureDefaultProject(t.db, scratch);
  expect(ensureDefaultRepository(t.db, projectId, scratch)).toBeNull();
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
  expect(ensureDefaultRepository(t.db, projectId, repo.root)).toBe("registered-repo");
  expect(getRepository(t.db, DEFAULT_REPOSITORY_ID)).toBeUndefined();
});
