import { afterEach, expect, it } from "vitest";

import {
  deleteAgentProfile,
  getAgentProfile,
  insertAgentProfile,
  listAgentProfiles,
  updateAgentProfile,
} from "#db/repositories/agent/profiles";
import { createTempDb, type TempDb } from "#test-support/temp-db";

let t: TempDb | null = null;

afterEach(() => {
  t?.cleanup();
  t = null;
});

it("round-trips a profile's typed json columns", () => {
  t = createTempDb("otomat-profiles-");
  insertAgentProfile(t.client.db, {
    id: "prof-1",
    name: "Reviewer",
    runtime: "claude",
    options_json: { permission_mode: "plan" },
    guidance: "Be careful",
    skill_ids_json: ["s1", "s2"],
  });
  const row = getAgentProfile(t.client.db, "prof-1");
  expect(row?.options_json).toEqual({ permission_mode: "plan" });
  expect(row?.skill_ids_json).toEqual(["s1", "s2"]);
  expect(row?.guidance).toBe("Be careful");
});

it("updates and deletes a profile", () => {
  t = createTempDb("otomat-profiles-");
  insertAgentProfile(t.client.db, {
    id: "p",
    name: "A",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: [],
  });
  updateAgentProfile(t.client.db, "p", {
    name: "B",
    runtime: "fake",
    options_json: {},
    guidance: null,
    skill_ids_json: ["x"],
  });
  expect(getAgentProfile(t.client.db, "p")?.name).toBe("B");
  expect(getAgentProfile(t.client.db, "p")?.skill_ids_json).toEqual(["x"]);
  deleteAgentProfile(t.client.db, "p");
  expect(getAgentProfile(t.client.db, "p")).toBeUndefined();
  expect(listAgentProfiles(t.client.db)).toHaveLength(0);
});
