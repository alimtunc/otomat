import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import { insertAgentProfile, listAgentProfiles } from "#db/repositories/agent/profiles";
import { getProject } from "#db/repositories/projects";
import { listSkills, upsertSkillByPath } from "#db/repositories/skills";
import { deleteRepositoryCascade } from "#db/repositories/workspace-removal";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-workspace-removal-");
  seedProject(t.client.db);
  t.client.db
    .insert(schema.repositories)
    .values({ id: "repo-1", project_id: "p1", name: "R", default_branch: "main" })
    .run();
});

afterEach(() => {
  t.cleanup();
});

it("removes the project's agents and skills with its last repository", () => {
  insertAgentProfile(t.client.db, {
    id: "scoped",
    name: "Scoped",
    project_id: "p1",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [],
  });
  insertAgentProfile(t.client.db, {
    id: "global",
    name: "Global",
    project_id: null,
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [],
  });
  upsertSkillByPath(t.client.db, "sk", {
    project_id: "p1",
    canonical_path: "/tmp/p/.agents/skills/x/SKILL.md",
    name: "X",
    description: null,
    content_hash: null,
    status: "available",
    invalid_reason: null,
  });

  expect(deleteRepositoryCascade(t.client.db, "repo-1")).toBe(true);

  expect(getProject(t.client.db, "p1")).toBeUndefined();
  expect(listSkills(t.client.db)).toEqual([]);
  expect(listAgentProfiles(t.client.db).map((row) => row.id)).toEqual(["global"]);
});
