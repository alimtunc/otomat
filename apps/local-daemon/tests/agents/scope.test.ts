import { join } from "node:path";

import { insertAgentProfile, insertProject, listSkills } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { rescanSkills, resolveAgentConfig, validateProfileInput } from "#agents";

import { setupTestDb, type TestDb } from "../support/db.js";
import { writeSkillFile } from "../support/skills.js";

let t: TestDb;
let userHome: string;

beforeEach(() => {
  t = setupTestDb("otomat-skill-scope-");
  userHome = join(t.dir, "home");
});

afterEach(() => {
  t.cleanup();
});

function writeSkill(root: string, name: string): void {
  writeSkillFile(join(root, name), `---\nname: ${name}\ndescription: d\n---\nBody`);
}

function seedCatalog() {
  writeSkill(join(userHome, ".claude", "skills"), "tdd");
  writeSkill(join(t.dir, ".agents", "skills"), "crm");
  rescanSkills(t.db, { home: userHome });
  const byName = new Map(listSkills(t.db).map((skill) => [skill.name, skill]));
  const user = byName.get("tdd");
  const project = byName.get("crm");
  if (!user || !project) throw new Error("catalog seed failed");
  return { user, project };
}

function saveProfile(id: string, projectId: string | null, skillIds: string[]): void {
  insertAgentProfile(t.db, {
    id,
    name: id,
    project_id: projectId,
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: skillIds,
  });
}

it("stamps each discovered skill with the project whose tree it came from", () => {
  const { user, project } = seedCatalog();
  expect(user.project_id).toBeNull();
  expect(project.project_id).toBe("p1");
});

it("refuses a project skill on a global profile and accepts a user skill", () => {
  const { user, project } = seedCatalog();

  expect(() =>
    validateProfileInput(t.db, {
      project_id: null,
      runtime: "fake",
      options: {},
      model: null,
      skill_ids: [project.id],
    }),
  ).toThrow(expect.objectContaining({ code: "skill_out_of_scope" }));
  expect(() =>
    validateProfileInput(t.db, {
      project_id: null,
      runtime: "fake",
      options: {},
      model: null,
      skill_ids: [user.id],
    }),
  ).not.toThrow();
});

it("lets a project profile combine its own project's skills with the user's", () => {
  const { user, project } = seedCatalog();
  saveProfile("prof", "p1", [user.id, project.id]);

  const config = resolveAgentConfig(t.db, { kind: "profile", profileId: "prof" });

  expect(config.skills.map((skill) => skill.name)).toEqual(["tdd", "crm"]);
});

it("refuses at launch when a profile keeps a skill that belongs to another project", () => {
  const { project } = seedCatalog();
  insertProject(t.db, { id: "p2", name: "Other", root_path: join(t.dir, "other") });
  saveProfile("prof", "p2", [project.id]);

  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "prof" })).toThrow(
    expect.objectContaining({ code: "skill_out_of_scope" }),
  );
});
