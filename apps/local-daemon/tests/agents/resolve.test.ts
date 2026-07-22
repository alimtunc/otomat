import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { insertAgentProfile, setSkillEnabled, upsertSkillByPath } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import {
  ProfileNotFoundError,
  ProfileOptionUnsupportedError,
  resolveAgentConfig,
  SkillResolutionError,
} from "#agents";

import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-resolve-");
});

afterEach(() => {
  t.cleanup();
});

function writeSkill(name: string, body: string): string {
  const dir = join(t.dir, "skills", name);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  writeFileSync(path, body);
  return path;
}

it("resolves an ad-hoc runtime to a minimal config", () => {
  const config = resolveAgentConfig(t.db, { kind: "runtime", runtimeId: "fake" });
  expect(config.runtime).toBe("fake");
  expect(config.profile_id).toBeNull();
  expect(config.guidance).toBeNull();
  expect(config.skills).toEqual([]);
  expect(config.config_hash).toBeTypeOf("string");
});

it("freezes a profile's guidance and captures skill instructions", () => {
  const path = writeSkill("alpha", "---\nname: Alpha\ndescription: d\n---\n\nAlpha instructions");
  const skillId = upsertSkillByPath(t.db, "sk-1", {
    source: "user",
    canonical_path: path,
    name: "Alpha",
    description: "d",
    content_hash: "x",
    status: "available",
    invalid_reason: null,
  });
  insertAgentProfile(t.db, {
    id: "pr-1",
    name: "P",
    runtime: "fake",
    options_json: {},
    guidance: "Be careful",
    skill_ids_json: [skillId],
  });

  const config = resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-1" });
  expect(config.profile_id).toBe("pr-1");
  expect(config.guidance).toBe("Be careful");
  expect(config.skills).toHaveLength(1);
  expect(config.skills[0]?.instructions).toContain("Alpha instructions");
  expect(config.skills[0]?.content_hash).toBeTypeOf("string");
});

it("throws when the profile does not exist", () => {
  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "nope" })).toThrow(
    ProfileNotFoundError,
  );
});

it("rejects an option the runtime does not support", () => {
  insertAgentProfile(t.db, {
    id: "pr-2",
    name: "P",
    runtime: "fake",
    options_json: { permission_mode: "plan" },
    guidance: null,
    skill_ids_json: [],
  });
  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-2" })).toThrow(
    ProfileOptionUnsupportedError,
  );
});

it("rejects a disabled skill referenced by a profile", () => {
  const path = writeSkill("beta", "---\nname: Beta\ndescription: d\n---\nBody");
  const skillId = upsertSkillByPath(t.db, "sk-2", {
    source: "user",
    canonical_path: path,
    name: "Beta",
    description: "d",
    content_hash: "x",
    status: "available",
    invalid_reason: null,
  });
  setSkillEnabled(t.db, skillId, false);
  insertAgentProfile(t.db, {
    id: "pr-3",
    name: "P",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [skillId],
  });
  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-3" })).toThrow(
    SkillResolutionError,
  );
});
