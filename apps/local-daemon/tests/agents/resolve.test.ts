import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  deleteAgentProfile,
  insertAgentProfile,
  setSkillEnabled,
  upsertSkillByPath,
  writeExecutionDefaults,
} from "@otomat/db";
import { overrideLevel } from "@otomat/domain";
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

it("rejects an option the installed runtime does not announce, saying why", () => {
  insertAgentProfile(t.db, {
    id: "pr-2",
    name: "P",
    runtime: "fake",
    // A mode a past CLI accepted: only what the installed one announces may reach argv.
    options_json: { permission_mode: "default" },
    guidance: null,
    skill_ids_json: [],
  });
  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-2" })).toThrow(
    ProfileOptionUnsupportedError,
  );
  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-2" })).toThrow(
    /permission_mode/,
  );
});

it("resolves a profile that overrides nothing without inventing an option", () => {
  insertAgentProfile(t.db, {
    id: "pr-defaults",
    name: "P",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [],
  });

  expect(resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-defaults" }).options).toEqual(
    {},
  );
});

it("layers a launch override on top of the profile's own model", () => {
  insertAgentProfile(t.db, {
    id: "pr-model",
    name: "P",
    runtime: "fake",
    options_json: {},
    model: "fake-fast",
    guidance: null,
    skill_ids_json: [],
  });

  const fromProfile = resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-model" });
  expect(fromProfile.model).toEqual({ id: "fake-fast", source: "static" });

  const overridden = resolveAgentConfig(
    t.db,
    { kind: "profile", profileId: "pr-model" },
    { levels: [overrideLevel("launch", { model: { kind: "provider_default" } })] },
  );
  expect(overridden.model).toBeNull();
  expect(overridden.sources?.model).toBe("launch");
  // The model is part of the frozen identity, so the same profile under two models never shares a hash.
  expect(overridden.config_hash).not.toBe(fromProfile.config_hash);
});

it("takes the host defaults only for the runtime they name", () => {
  writeExecutionDefaults(t.db, {
    runtime: "fake",
    model: "fake-fast",
    options: { effort: "low" },
  });
  insertAgentProfile(t.db, {
    id: "pr-empty",
    name: "P",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [],
  });

  const config = resolveAgentConfig(t.db, { kind: "profile", profileId: "pr-empty" });
  expect(config.model).toEqual({ id: "fake-fast", source: "static" });
  expect(config.options).toEqual({ effort: "low" });
  expect(config.sources).toEqual({
    runtime: "launch",
    model: "global",
    options: { effort: "global" },
  });
});

it("drops a host default the chosen model does not publish, leaving the runtime's own", () => {
  writeExecutionDefaults(t.db, {
    runtime: "fake",
    model: null,
    options: { effort: "high" },
  });

  const config = resolveAgentConfig(
    t.db,
    { kind: "runtime", runtimeId: "fake" },
    { levels: [overrideLevel("launch", { model: { kind: "model", id: "fake-fast" } })] },
  );
  expect(config.options).toEqual({ effort: "low" });
  expect(config.sources?.options).toEqual({ effort: "provider" });
});

it("freezes the runtime's announced default when no level selects one", () => {
  const config = resolveAgentConfig(
    t.db,
    { kind: "runtime", runtimeId: "fake" },
    { levels: [overrideLevel("launch", { model: { kind: "model", id: "fake-thorough" } })] },
  );

  expect(config.options).toEqual({ effort: "low" });
  expect(config.sources?.options).toEqual({ effort: "provider" });
});

it("refuses to launch a profile another host deleted", () => {
  insertAgentProfile(t.db, {
    id: "p-gone",
    name: "Gone",
    runtime: "fake",
    options_json: {},
    model: null,
    guidance: null,
    skill_ids_json: [],
  });
  deleteAgentProfile(t.db, "p-gone");

  expect(() => resolveAgentConfig(t.db, { kind: "profile", profileId: "p-gone" })).toThrow(
    ProfileNotFoundError,
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
