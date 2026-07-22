import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRun, insertAgentProfile, updateAgentProfile, upsertSkillByPath } from "@otomat/db";
import { isRunPlanCompeteGroup } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("freezes the resolved profile config into plan_json and keeps it immutable after a profile edit", async () => {
  const dir = join(fix.dataDir, "skills", "guide");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  writeFileSync(path, "---\nname: Guide\ndescription: d\n---\nOriginal instructions");
  const skillId = upsertSkillByPath(fix.db, "sk", {
    source: "user",
    canonical_path: path,
    name: "Guide",
    description: "d",
    content_hash: "x",
    status: "available",
    invalid_reason: null,
  });
  insertAgentProfile(fix.db, {
    id: "prof",
    name: "Careful",
    runtime: "fake",
    options_json: {},
    guidance: "Original guidance",
    skill_ids_json: [skillId],
  });

  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "do it", profile_id: "prof" });
  await supervisor.settle();

  const step = getRun(fix.db, run.id)?.plan_json.steps[0];
  const frozen = step && !isRunPlanCompeteGroup(step) ? step.config : null;
  expect(frozen?.profile_id).toBe("prof");
  expect(frozen?.profile_name).toBe("Careful");
  expect(frozen?.guidance).toBe("Original guidance");
  expect(frozen?.skills[0]?.instructions).toContain("Original instructions");
  const frozenHash = frozen?.config_hash;

  // Edit the profile and the skill file after launch — the existing run must not change.
  updateAgentProfile(fix.db, "prof", {
    name: "Changed",
    guidance: "New guidance",
    skill_ids_json: [],
  });
  writeFileSync(path, "---\nname: Guide\ndescription: d\n---\nRewritten instructions");

  const afterStep = getRun(fix.db, run.id)?.plan_json.steps[0];
  const afterConfig = afterStep && !isRunPlanCompeteGroup(afterStep) ? afterStep.config : null;
  expect(afterConfig?.guidance).toBe("Original guidance");
  expect(afterConfig?.skills[0]?.instructions).toContain("Original instructions");
  expect(afterConfig?.config_hash).toBe(frozenHash);
});
