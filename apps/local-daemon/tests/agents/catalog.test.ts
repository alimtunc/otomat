import { mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { rescanSkills } from "#agents";

import { setupTestDb, type TestDb } from "../support/db.js";
import { writeSkillFile } from "../support/skills.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-catalog-");
});

afterEach(() => {
  t.cleanup();
});

function writeSkill(name: string, body: string): void {
  writeSkillFile(join(t.dir, ".agents", "skills", name), body);
}

it("discovers valid and invalid skills under a project root", () => {
  writeSkill("good", "---\nname: Good\ndescription: ok\n---\nBody");
  writeSkill("nofm", "no frontmatter here");
  const skills = rescanSkills(t.db, { home: null });
  const good = skills.find((skill) => skill.name === "Good");
  expect(good?.status).toBe("available");
  expect(good?.project_id).toBe("p1");
  const invalid = skills.find((skill) => skill.canonical_path.includes("nofm"));
  expect(invalid?.status).toBe("invalid");
  expect(invalid?.invalid_reason).toBe("frontmatter_missing");
});

it("deduplicates one skill exposed through both harness roots", () => {
  writeSkill("shared", "---\nname: Shared\ndescription: ok\n---\nBody");
  const claudeSkills = join(t.dir, ".claude", "skills");
  mkdirSync(claudeSkills, { recursive: true });
  symlinkSync("../../.agents/skills/shared", join(claudeSkills, "shared"));

  const skills = rescanSkills(t.db, { home: null }).filter((skill) => skill.name === "Shared");

  expect(skills).toHaveLength(1);
  expect(skills[0]?.canonical_path).toBe(
    realpathSync(join(t.dir, ".agents", "skills", "shared", "SKILL.md")),
  );
});

it("discovers shared and legacy user roots without merging homonymous skills", () => {
  const home = join(t.dir, "home");
  for (const root of [".agents", ".claude", ".codex"]) {
    writeSkillFile(join(home, root, "skills", "guide"), "---\nname: Guide\n---\nBody");
  }
  writeSkill("guide", "---\nname: Guide\n---\nProject body");
  writeSkillFile(
    join(home, ".codex", "skills", ".system", "hidden"),
    "---\nname: Hidden\n---\nBody",
  );

  const skills = rescanSkills(t.db, { home });

  expect(skills.filter((skill) => skill.name === "Guide")).toHaveLength(4);
  expect(skills.filter((skill) => skill.project_id === null)).toHaveLength(3);
  expect(skills.some((skill) => skill.name === "Hidden")).toBe(false);
});

it("keeps one user-owned entry when project and harness roots link to a shared user skill", () => {
  const home = join(t.dir, "home");
  const shared = join(home, ".agents", "skills", "shared");
  writeSkillFile(shared, "---\nname: Shared\n---\nBody");
  for (const root of [join(home, ".claude"), join(home, ".codex"), join(t.dir, ".agents")]) {
    mkdirSync(join(root, "skills"), { recursive: true });
    symlinkSync(shared, join(root, "skills", "shared"));
  }

  const [skill, ...others] = rescanSkills(t.db, { home });

  expect(others).toHaveLength(0);
  expect(skill?.project_id).toBeNull();
  expect(skill?.canonical_path).toBe(realpathSync(join(shared, "SKILL.md")));
  expect(rescanSkills(t.db, { home }).map((entry) => entry.id)).toEqual([skill?.id]);
});

it("marks a removed skill as path_missing on the next rescan", () => {
  writeSkill("temp", "---\nname: Temp\ndescription: d\n---\nBody");
  const first = rescanSkills(t.db, { home: null });
  const temp = first.find((skill) => skill.name === "Temp");
  expect(temp?.status).toBe("available");

  rmSync(join(t.dir, ".agents", "skills", "temp"), { recursive: true, force: true });
  const second = rescanSkills(t.db, { home: null });
  const gone = second.find((skill) => skill.id === temp?.id);
  expect(gone?.status).toBe("invalid");
  expect(gone?.invalid_reason).toBe("path_missing");
});
