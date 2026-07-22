import { afterEach, expect, it } from "vitest";

import {
  getSkill,
  markSkillsMissing,
  setSkillEnabled,
  upsertSkillByPath,
  type SkillDiscovery,
} from "#db/repositories/skills";

import { createTempDb, type TempDb } from "../support/temp-db.js";

let t: TempDb | null = null;

afterEach(() => {
  t?.cleanup();
  t = null;
});

function discovery(path: string, overrides: Partial<SkillDiscovery> = {}): SkillDiscovery {
  return {
    source: "user",
    canonical_path: path,
    name: "n",
    description: null,
    content_hash: "h",
    status: "available",
    invalid_reason: null,
    ...overrides,
  };
}

it("upsert by path preserves the id and enabled choice across rescans", () => {
  t = createTempDb("otomat-skills-");
  const id = upsertSkillByPath(t.client.db, "new-1", discovery("/a/SKILL.md"));
  setSkillEnabled(t.client.db, id, false);
  const again = upsertSkillByPath(
    t.client.db,
    "new-2",
    discovery("/a/SKILL.md", { name: "renamed", content_hash: "h2" }),
  );
  expect(again).toBe(id);
  const row = getSkill(t.client.db, id);
  expect(row?.enabled).toBe(false);
  expect(row?.name).toBe("renamed");
  expect(row?.content_hash).toBe("h2");
});

it("marks vanished skills as path_missing without deleting them", () => {
  t = createTempDb("otomat-skills-");
  const kept = upsertSkillByPath(t.client.db, "k", discovery("/keep/SKILL.md"));
  const gone = upsertSkillByPath(t.client.db, "g", discovery("/gone/SKILL.md"));
  markSkillsMissing(t.client.db, [kept]);
  expect(getSkill(t.client.db, kept)?.status).toBe("available");
  expect(getSkill(t.client.db, gone)?.status).toBe("invalid");
  expect(getSkill(t.client.db, gone)?.invalid_reason).toBe("path_missing");
});
