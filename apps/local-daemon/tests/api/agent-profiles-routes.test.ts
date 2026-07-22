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
