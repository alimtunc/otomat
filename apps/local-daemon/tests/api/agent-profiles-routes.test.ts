import {
  AGENT_PROFILE_NAME_MAX_LENGTH,
  type AgentProfileContract,
  type AgentProfileReplica,
} from "@otomat/domain";
import type { Hono } from "hono";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { json, makeApiApp, patch, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;
let other: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-profiles-api-");
  other = setupTestDb("otomat-profiles-api-other-");
});

afterEach(() => {
  vi.unstubAllEnvs();
  t.cleanup();
  other.cleanup();
});

/** The round the desktop shell drives: forward through each daemon, then the converged catalog back. */
async function sync(...apps: Hono[]): Promise<void> {
  let profiles: AgentProfileReplica["profiles"] = [];
  for (const app of apps) {
    profiles = (
      await json<AgentProfileReplica>(await post(app, "/api/agent-profiles/replica", { profiles }))
    ).profiles;
  }
  for (const app of apps.slice(0, -1)) {
    await post(app, "/api/agent-profiles/replica", { profiles });
  }
}

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

it("keeps an option this host does not announce and reports the incompatibility", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", {
      name: "P",
      runtime: "fake",
      options: { permission_mode: "plan" },
    }),
  );

  expect(created.options).toEqual({ permission_mode: "plan" });
  expect(created.compatibility?.error).toBe("option_unsupported");
  expect(created.compatibility?.message).toBeTypeOf("string");
});

it("carries a profile between two hosts, edits and deletes it from either one", async () => {
  const local = makeApiApp(t);
  const vps = makeApiApp(other);

  const onVps = await json<AgentProfileContract>(
    await post(vps, "/api/agent-profiles", { name: "Implementer", runtime: "fake" }),
  );
  await sync(local, vps);

  const onLocal = await json<AgentProfileContract[]>(await request(local, "/api/agent-profiles"));
  expect(onLocal.map((profile) => profile.id)).toEqual([onVps.id]);

  await patch(local, `/api/agent-profiles/${onVps.id}`, { name: "Reviewer", runtime: "fake" });
  await sync(local, vps);
  expect(
    (await json<AgentProfileContract[]>(await request(vps, "/api/agent-profiles")))[0]?.name,
  ).toBe("Reviewer");

  await request(vps, `/api/agent-profiles/${onVps.id}`, { method: "DELETE" });
  await sync(local, vps);
  expect(await json<AgentProfileContract[]>(await request(local, "/api/agent-profiles"))).toEqual(
    [],
  );
});

it("leaves an unreachable host behind and carries its edit over on the next round", async () => {
  const local = makeApiApp(t);
  const vps = makeApiApp(other);

  const offline = await json<AgentProfileContract>(
    await post(vps, "/api/agent-profiles", { name: "Written while offline", runtime: "fake" }),
  );
  const alone = await json<AgentProfileReplica>(
    await post(local, "/api/agent-profiles/replica", { profiles: [] }),
  );
  expect(alone.profiles).toEqual([]);

  await sync(local, vps);

  expect(
    (await json<AgentProfileContract[]>(await request(local, "/api/agent-profiles"))).map(
      (profile) => profile.id,
    ),
  ).toEqual([offline.id]);
});

it("collapses the same profile two hosts created separately", async () => {
  const local = makeApiApp(t);
  const vps = makeApiApp(other);

  await post(local, "/api/agent-profiles", { name: "Implementer", runtime: "fake" });
  await post(vps, "/api/agent-profiles", { name: "Implementer", runtime: "fake" });
  await sync(local, vps);

  for (const app of [local, vps]) {
    const listed = await json<AgentProfileContract[]>(await request(app, "/api/agent-profiles"));
    expect(listed.map((profile) => profile.name)).toEqual(["Implementer"]);
  }
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

  const unlisted = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "Q", runtime: "fake", model: "gpt-5" }),
  );
  expect(unlisted.model).toBe("gpt-5");
  expect(unlisted.compatibility?.error).toBe("model_unknown");
  expect(unlisted.compatibility?.message).toContain("gpt-5");
});

it("defaults a profile with no model to the provider default", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "P", runtime: "fake" }),
  );
  expect(created.model).toBeNull();
});

it("keeps a profile whose runtime this host has no binary for and names what is missing", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", { name: "Claude", runtime: "claude" }),
  );

  vi.stubEnv("PATH", "");
  const listed = await json<AgentProfileContract[]>(await request(app, "/api/agent-profiles"));

  expect(listed.map((profile) => profile.id)).toEqual([created.id]);
  expect(listed[0]?.compatibility?.error).toBe("runtime_unavailable");
});

it("refuses an unknown runtime", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/agent-profiles", { name: "P", runtime: "made-up" });
  expect(res.status).toBe(400);
  expect((await json<{ error: string }>(res)).error).toBe("runtime_unknown");
});

it("keeps a skill another host discovered and reports it as missing here", async () => {
  const app = makeApiApp(t);
  const created = await json<AgentProfileContract>(
    await post(app, "/api/agent-profiles", {
      name: "P",
      runtime: "fake",
      skill_ids: ["discovered-on-the-vps"],
    }),
  );

  expect(created.skill_ids).toEqual(["discovered-on-the-vps"]);
  expect(created.compatibility?.error).toBe("skill_unknown");
});
