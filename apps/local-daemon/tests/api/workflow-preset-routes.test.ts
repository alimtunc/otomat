import { insertAgentProfile, schema } from "@otomat/db";
import type { WorkflowPresetContract, WorkflowPresetPlan } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { del, json, makeApiApp, patch, post, request } from "../support/api.js";
import { setupTestDb, type TestDb } from "../support/db.js";

let t: TestDb;

beforeEach(() => {
  t = setupTestDb("otomat-presets-api-");
});

afterEach(() => {
  t.cleanup();
});

function plan(steps: WorkflowPresetPlan["steps"] = []): WorkflowPresetPlan {
  return { version: 1, steps };
}

const IMPLEMENT = { id: "implement", name: "Implement", agent: "fake", depends_on: [] };

function seedProfile(id: string, runtime = "fake"): string {
  insertAgentProfile(t.db, {
    id,
    name: `profile ${id}`,
    runtime,
    options_json: {},
    model: null,
    guidance: null,
    skill_ids_json: [],
  });
  return id;
}

it("creates, lists, edits and deletes a preset in each scope", async () => {
  const app = makeApiApp(t);

  const global = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Ship it",
      plan: plan([IMPLEMENT]),
    }),
  );
  expect(global.scope).toBe("global");
  expect(global.project_id).toBeNull();

  const scoped = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "project",
      project_id: "p1",
      name: "Ship it",
      plan: plan(),
    }),
  );
  expect(scoped.project_id).toBe("p1");

  const forProject = await json<WorkflowPresetContract[]>(
    await request(app, "/api/workflow-presets?project_id=p1"),
  );
  expect(forProject.map((preset) => preset.id).toSorted()).toEqual(
    [global.id, scoped.id].toSorted(),
  );

  const renamed = await json<WorkflowPresetContract>(
    await patch(app, `/api/workflow-presets/${global.id}`, {
      scope: "global",
      name: "Ship it twice",
      plan: plan([IMPLEMENT]),
    }),
  );
  expect(renamed.name).toBe("Ship it twice");

  expect((await del(app, `/api/workflow-presets/${scoped.id}`)).status).toBe(204);
  expect(
    await json<WorkflowPresetContract[]>(await request(app, "/api/workflow-presets?project_id=p1")),
  ).toHaveLength(1);
});

it("keeps a project preset out of every other project's library", async () => {
  t.db
    .insert(schema.projects)
    .values({ id: "p2", name: "Other", root_path: `${t.dir}/other` })
    .run();
  const app = makeApiApp(t);
  await post(app, "/api/workflow-presets", {
    scope: "project",
    project_id: "p1",
    name: "Local only",
    plan: plan(),
  });
  await post(app, "/api/workflow-presets", { scope: "global", name: "Everywhere", plan: plan() });

  const other = await json<WorkflowPresetContract[]>(
    await request(app, "/api/workflow-presets?project_id=p2"),
  );
  expect(other.map((preset) => preset.name)).toEqual(["Everywhere"]);
});

it("refuses a name already used in the same scope, and allows it in another", async () => {
  const app = makeApiApp(t);
  await post(app, "/api/workflow-presets", { scope: "global", name: "Review", plan: plan() });

  const collision = await post(app, "/api/workflow-presets", {
    scope: "global",
    name: "Review",
    plan: plan(),
  });
  expect(collision.status).toBe(409);
  expect((await json<{ error: string; message: string }>(collision)).error).toBe(
    "preset_name_taken",
  );

  const scoped = await post(app, "/api/workflow-presets", {
    scope: "project",
    project_id: "p1",
    name: "Review",
    plan: plan(),
  });
  expect(scoped.status).toBe(201);
});

it("refuses a project the host does not know", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/workflow-presets", {
    scope: "project",
    project_id: "ghost",
    name: "Nowhere",
    plan: plan(),
  });
  expect(res.status).toBe(404);
  expect((await json<{ error: string }>(res)).error).toBe("preset_project_unknown");
});

it("copies a global preset into a project without touching its source", async () => {
  const app = makeApiApp(t);
  const source = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Ship",
      plan: plan([IMPLEMENT]),
    }),
  );

  const copy = await json<WorkflowPresetContract>(
    await post(app, `/api/workflow-presets/${source.id}/duplicate`, {
      scope: "project",
      project_id: "p1",
    }),
  );
  expect(copy.id).not.toBe(source.id);
  expect(copy.scope).toBe("project");
  expect(copy.plan).toEqual(source.plan);

  await patch(app, `/api/workflow-presets/${copy.id}`, {
    scope: "project",
    project_id: "p1",
    name: copy.name,
    plan: plan(),
  });

  const listed = await json<WorkflowPresetContract[]>(
    await request(app, "/api/workflow-presets?project_id=p1"),
  );
  expect(listed.find((preset) => preset.id === source.id)?.plan.steps).toHaveLength(1);
});

it("numbers a second copy rather than colliding with the first", async () => {
  const app = makeApiApp(t);
  const source = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", { scope: "global", name: "Ship", plan: plan() }),
  );

  const first = await json<WorkflowPresetContract>(
    await post(app, `/api/workflow-presets/${source.id}/duplicate`, { scope: "global" }),
  );
  const second = await json<WorkflowPresetContract>(
    await post(app, `/api/workflow-presets/${source.id}/duplicate`, { scope: "global" }),
  );
  expect(first.name).toBe("Ship (copy)");
  expect(second.name).toBe("Ship (copy) 2");
});

it("reports a node whose profile left the host, and stays launchable once it is back", async () => {
  const app = makeApiApp(t);
  seedProfile("profile-1");
  const preset = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Profiled",
      plan: plan([
        { id: "review", name: "Review", agent: null, profile_id: "profile-1", depends_on: [] },
      ]),
    }),
  );
  expect(preset.compatibility.launchable).toBe(true);

  t.db.delete(schema.agentProfiles).run();
  const [stale] = await json<WorkflowPresetContract[]>(await request(app, "/api/workflow-presets"));
  expect(stale?.compatibility.launchable).toBe(false);
  expect(stale?.compatibility.issues).toEqual([
    {
      node_id: "review",
      node_name: "Review",
      error: "profile_not_found",
      message: expect.any(String),
    },
  ]);
});

it("refuses to call an empty preset launchable", async () => {
  const app = makeApiApp(t);
  const preset = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", { scope: "global", name: "Empty", plan: plan() }),
  );
  expect(preset.compatibility).toEqual({ launchable: false, issues: [] });
});

it("reports an unknown runtime on the node that names it", async () => {
  const app = makeApiApp(t);
  const preset = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Gone",
      plan: plan([{ id: "build", name: "Build", agent: "typewriter", depends_on: [] }]),
    }),
  );
  expect(preset.compatibility.launchable).toBe(false);
  expect(preset.compatibility.issues[0]?.error).toBe("runtime_unknown");
});

it("stays silent about a node that inherits the launch's agent", async () => {
  const app = makeApiApp(t);
  const preset = await json<WorkflowPresetContract>(
    await post(app, "/api/workflow-presets", {
      scope: "global",
      name: "Inherited",
      plan: plan([{ id: "work", name: "Work", agent: null, depends_on: [] }]),
    }),
  );
  expect(preset.compatibility).toEqual({ launchable: true, issues: [] });
});

it("refuses a plan whose dependency does not exist", async () => {
  const app = makeApiApp(t);
  const res = await post(app, "/api/workflow-presets", {
    scope: "global",
    name: "Broken",
    plan: plan([{ id: "review", name: "Review", agent: null, depends_on: ["implement"] }]),
  });
  expect(res.status).toBe(400);
  expect((await json<{ error: string }>(res)).error).toBe("invalid_request");
});

it("answers 404 for a preset that is not there", async () => {
  const app = makeApiApp(t);
  const res = await del(app, "/api/workflow-presets/ghost");
  expect(res.status).toBe(404);
  expect((await json<{ error: string }>(res)).error).toBe("preset_not_found");
});
