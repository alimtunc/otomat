import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SkillContract } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-skills-api-");
});

afterEach(() => {
  t.cleanup();
});

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

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
    await request(app, `/api/skills/${skill?.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    }),
  );
  expect(toggled.enabled).toBe(false);
});

it("returns 404 when toggling a skill that does not exist", async () => {
  const app = makeApiApp(t);
  const res = await request(app, "/api/skills/ghost", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  });
  expect(res.status).toBe(404);
});
