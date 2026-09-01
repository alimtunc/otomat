import { join } from "node:path";

import { upsertSkillByPath } from "@otomat/db";
import { AGENT_PROFILE_NAME_MAX_LENGTH, type AgentProfileContract } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, makeApiApp, patch, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-profiles-api-");
});

afterEach(() => {
  t.cleanup();
});

it("creates, lists, updates, duplicates and deletes a profile", async () => {
  const app = makeApiApp(t);

  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "P", runtime: "fake" }),
  );
  expect(created.name).toBe("P");
  expect(created.runtime).toBe("fake");

  const list = await json<AgentProfileContract[]>(await request(app, "/api/agent-profiles"));
  expect(list).toHaveLength(1);

  const updated = await json<AgentProfileContract>(
    await patch(app, `/api/agent-profiles/${created.id}`, { name: "Q", runtime: "fake" }),
  );
  expect(updated.name).toBe("Q");

  const duplicated = await json<AgentProfileContract>(
    await post(app, `/api/agent-profiles/${created.id}/duplicate`, {}),
  );
  expect(duplicated.name).toBe("Q (copy)");
  expect(duplicated.id).not.toBe(created.id);

  const deleted = await request(app, `/api/agent-profiles/${created.id}`, { method: "DELETE" });
  expect(deleted.status).toBe(204);
  expect(
    await json<AgentProfileContract[]>(await request(app, "/api/agent-profiles")),
  ).toHaveLength(1);
});

it("clamps a duplicated name to the domain length limit", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", {
      name: "x".repeat(AGENT_PROFILE_NAME_MAX_LENGTH),
      runtime: "fake",
    }),
  );

  const duplicated = await json<AgentProfileContract>(
    await post(app, `/api/agent-profiles/${created.id}/duplicate`, {}),
  );

  expect(duplicated.name.length).toBeLessThanOrEqual(AGENT_PROFILE_NAME_MAX_LENGTH);
  expect(duplicated.name.endsWith(" (copy)")).toBe(true);
});

it("refuses an unsupported provider option honestly", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/agent-profiles", {
    name: "P",
    runtime: "fake",
    options: { permission_mode: "plan" },
  });
  expect(res.status).toBe(400);
  const body = await json<{ error: string; message: string }>(res);
  expect(body.error).toBe("option_unsupported");
  expect(body.message).toBeTypeOf("string");
});

it("stores a model the runtime lists, carries it through a duplicate, and refuses an unlisted one", async () => {
  const app = makeApiApp(t);

  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "P", runtime: "fake", model: "fake-fast" }),
  );
  expect(created.model).toBe("fake-fast");

  const duplicated = await json<AgentProfileContract>(
    await post(app, `/api/agent-profiles/${created.id}/duplicate`, {}),
  );
  expect(duplicated.model).toBe("fake-fast");

  const refused = await post(app, "/api/agent-profiles", {
    name: "Q",
    runtime: "fake",
    model: "gpt-5",
  });
  expect(refused.status).toBe(400);
  const body = await json<{ error: string; message: string }>(refused);
  expect(body.error).toBe("model_unknown");
  expect(body.message).toContain("gpt-5");
});

it("defaults a profile with no model to the provider default", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "P", runtime: "fake" }),
  );
  expect(created.model).toBeNull();
});

it("refuses an unknown runtime", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/agent-profiles", { name: "P", runtime: "made-up" });
  expect(res.status).toBe(400);
  expect((await json<{ error: string }>(res)).error).toBe("runtime_unknown");
});

it("refuses a skill that is not in the catalog", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/agent-profiles", {
    name: "P",
    runtime: "fake",
    skill_ids: ["ghost"],
  });
  expect(res.status).toBe(400);
  expect((await json<{ error: string }>(res)).error).toBe("skill_unknown");
});

it("refuses a project that is not registered on this host", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/agent-profiles", {
    name: "P",
    runtime: "fake",
    project_id: "ghost",
  });
  expect(res.status).toBe(404);
  expect((await json<{ error: string }>(res)).error).toBe("profile_project_unknown");
});

it("refuses a project skill on a global profile and keeps it on the project's own", async () => {
  const app = makeApiApp(t);
  const skillId = upsertSkillByPath(t.db, "sk-crm", {
    project_id: "p1",
    canonical_path: join(t.dir, ".agents", "skills", "crm", "SKILL.md"),
    name: "CRM",
    description: "d",
    content_hash: "x",
    status: "available",
    invalid_reason: null,
  });

  const refused = await post(app, "/api/agent-profiles", {
    name: "Global",
    runtime: "fake",
    skill_ids: [skillId],
  });
  expect(refused.status).toBe(409);
  expect((await json<{ error: string }>(refused)).error).toBe("skill_out_of_scope");

  const scoped = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", {
      name: "Project",
      runtime: "fake",
      project_id: "p1",
      skill_ids: [skillId],
    }),
  );
  expect(scoped.project_id).toBe("p1");
  expect(scoped.skill_ids).toEqual([skillId]);
});

it("keeps a profile's owning project when an update omits it", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "Scoped", runtime: "fake", project_id: "p1" }),
  );

  const patched = await json<AgentProfileContract>(
    await patch(app, `/api/agent-profiles/${created.id}`, { name: "Renamed", runtime: "fake" }),
  );

  expect(patched.project_id).toBe("p1");
});

it("lists global profiles alone, and adds a project's own when one is named", async () => {
  const app = makeApiApp(t);
  await post(app, "/api/agent-profiles", { name: "Global", runtime: "fake" });
  await post(app, "/api/agent-profiles", { name: "Scoped", runtime: "fake", project_id: "p1" });

  const global = await json<AgentProfileContract[]>(await request(app, "/api/agent-profiles"));
  const scoped = await json<AgentProfileContract[]>(
    await request(app, "/api/agent-profiles?project_id=p1"),
  );

  expect(global.map((profile) => profile.name)).toEqual(["Global"]);
  expect(scoped.map((profile) => profile.name)).toEqual(["Global", "Scoped"]);
});
