import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { rescanSkills } from "#agents";

import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-catalog-");
});

afterEach(() => {
  t.cleanup();
});

function writeSkill(name: string, body: string): void {
  const dir = join(t.dir, ".agents", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), body);
}

it("discovers valid and invalid skills under a project root", () => {
  writeSkill("good", "---\nname: Good\ndescription: ok\n---\nBody");
  writeSkill("nofm", "no frontmatter here");
  const skills = rescanSkills(t.db, { home: null });
  const good = skills.find((skill) => skill.name === "Good");
  expect(good?.status).toBe("available");
  expect(good?.source).toBe("project");
  const invalid = skills.find((skill) => skill.canonical_path.includes("nofm"));
  expect(invalid?.status).toBe("invalid");
  expect(invalid?.invalid_reason).toBe("frontmatter_missing");
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
