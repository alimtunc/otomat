import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getProject,
  getProjectByRootPath,
  insertProject,
  listProjects,
  updateProjectRootPath,
} from "#db/repositories/projects";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-projects-");
});

afterEach(() => {
  t.cleanup();
});

it("gets a project by id and returns undefined when absent", () => {
  seedProject(t.client.db);
  expect(getProject(t.client.db, "p1")?.name).toBe("P");
  expect(getProject(t.client.db, "ghost")).toBeUndefined();
  expect(listProjects(t.client.db).map((project) => project.id)).toEqual(["p1"]);
});

it("looks a project up by exact root_path", () => {
  seedProject(t.client.db);
  expect(getProjectByRootPath(t.client.db, "/tmp/p")?.id).toBe("p1");
  expect(getProjectByRootPath(t.client.db, "/tmp/other")).toBeUndefined();
});

it("rejects a second project on the same root_path (unique index)", () => {
  seedProject(t.client.db);
  expect(() => insertProject(t.client.db, { id: "p2", name: "Dup", root_path: "/tmp/p" })).toThrow(
    /UNIQUE/,
  );
  expect(listProjects(t.client.db)).toHaveLength(1);
});

it("re-anchors a project root_path", () => {
  seedProject(t.client.db);
  updateProjectRootPath(t.client.db, "p1", "/tmp/moved");
  expect(getProject(t.client.db, "p1")?.root_path).toBe("/tmp/moved");
});
