import { afterEach, beforeEach, expect, it } from "vitest";

import { getProject, listProjects } from "#db/repositories/projects";

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
