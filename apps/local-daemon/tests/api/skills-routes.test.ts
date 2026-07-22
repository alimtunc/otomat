import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SkillContract } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { json, makeApiApp, patch, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

// The scan route reads the user skills root via homedir(); pin it so the test never ingests the developer's real ~/.claude/skills.
vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/otomat-test-no-home",
}));

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-skills-api-");
});

afterEach(() => {
  t.cleanup();
});

it("scans the project root, lists the catalog and toggles enablement", async () => {
  const dir = join(t.dir, ".agents", "skills", "x");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "---\nname: X\ndescription: d\n---\nBody");

  const app = makeApiApp(t);

  const scanned = await json<SkillContract[]>(await post(app, "/api/skills/scan", {}));
  const skill = scanned.find((entry) => entry.name === "X");
  expect(skill).toBeDefined();
  expect(skill?.status).toBe("available");

  const listed = await json<SkillContract[]>(await request(app, "/api/skills"));
  expect(listed.some((entry) => entry.id === skill?.id)).toBe(true);

  const toggled = await json<SkillContract>(
    await patch(app, `/api/skills/${skill?.id}`, { enabled: false }),
  );
  expect(toggled.enabled).toBe(false);
});

it("returns 404 when toggling a skill that does not exist", async () => {
  const app = makeApiApp(t);
  const res = await patch(app, "/api/skills/ghost", { enabled: true });
  expect(res.status).toBe(404);
});
