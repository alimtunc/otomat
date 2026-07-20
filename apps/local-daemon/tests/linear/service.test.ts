import { listIssues } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createLinearService, linearError, type LinearService } from "#linear";

import { setupTestDb, type TestDb } from "../support/db.js";
import { stubLinearApiClient } from "../support/linear.js";

const VIEWER = { user_name: "Alim", workspace_name: "Otomat", workspace_url_key: "otomat" };

const TEAM = {
  external_team_id: "team-1",
  external_team_key: "OTO",
  external_team_name: "Otomat",
};

let t: TestDb;
let ids: number;

function service(overrides: Parameters<typeof stubLinearApiClient>[0] = {}): LinearService {
  return createLinearService({
    db: t.db,
    client: stubLinearApiClient({ viewer: async () => VIEWER, ...overrides }),
    idFactory: () => `src-${(ids += 1)}`,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
  });
}

beforeEach(() => {
  t = setupTestDb("otomat-linear-service-");
  ids = 0;
});

afterEach(() => {
  t.cleanup();
});

it("starts disconnected and reports the workspace once connected", async () => {
  const linear = service();

  expect(linear.connection().status).toBe("disconnected");
  const connection = await linear.connect("lin_api_secret");

  expect(connection).toEqual({
    status: "connected",
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  });
  expect(JSON.stringify(connection)).not.toContain("lin_api_secret");
});

it("refuses a rejected key and keeps nothing", async () => {
  const linear = service({
    viewer: async () => {
      throw linearError("linear_unauthorized");
    },
  });

  const connection = await linear.connect("bad-key");

  expect(connection).toMatchObject({ status: "failed", error_code: "linear_unauthorized" });
  await expect(linear.sync()).rejects.toMatchObject({ code: "linear_not_connected" });
});

it("forgets the key on disconnect", async () => {
  const linear = service();
  await linear.connect("lin_api_secret");

  expect(linear.disconnect().status).toBe("disconnected");
  await expect(linear.workspace()).rejects.toMatchObject({ code: "linear_not_connected" });
});

it("drops a connection whose key was revoked mid-use", async () => {
  const linear = service({
    workspace: async () => {
      throw linearError("linear_unauthorized");
    },
  });
  await linear.connect("lin_api_secret");

  await expect(linear.workspace()).rejects.toMatchObject({ code: "linear_unauthorized" });
  expect(linear.connection()).toMatchObject({
    status: "failed",
    error_code: "linear_unauthorized",
  });
});

it("maps a source onto an existing local project and refuses a duplicate", () => {
  const linear = service();

  const source = linear.createSource({ project_id: "p1", ...TEAM });

  expect(source).toMatchObject({
    source: "linear",
    project_id: "p1",
    external_team_key: "OTO",
    external_project_id: "",
    last_synced_at: null,
  });
  expect(() => linear.createSource({ project_id: "p1", ...TEAM })).toThrow(
    expect.objectContaining({ code: "linear_source_already_mapped" }),
  );
  expect(linear.sources()).toHaveLength(1);
});

it("refuses a source pointing at a project that does not exist locally", () => {
  const linear = service();

  expect(() => linear.createSource({ project_id: "missing", ...TEAM })).toThrow(
    expect.objectContaining({ code: "linear_project_not_found" }),
  );
});

it("narrowing to a Linear project is a distinct mapping of the same team", () => {
  const linear = service();

  linear.createSource({ project_id: "p1", ...TEAM });
  linear.createSource({
    project_id: "p1",
    ...TEAM,
    external_project_id: "proj-1",
    external_project_name: "V1 Alpha",
  });

  expect(linear.sources().map((source) => source.external_project_name)).toEqual(["", "V1 Alpha"]);
});

it("refuses to sync an unknown source", async () => {
  const linear = service();
  await linear.connect("lin_api_secret");

  await expect(linear.sync("missing")).rejects.toMatchObject({ code: "linear_source_not_found" });
});

it("syncs every mapped source and reports what landed", async () => {
  const linear = service({
    issues: async (_apiKey, query) => [
      {
        id: `uuid-${query.team_id}`,
        identifier: "OTO-1",
        title: "Mirror me",
        description: null,
        url: "https://linear.app/otomat/issue/OTO-1",
        updated_at: "2026-07-20T11:00:00.000Z",
        state_type: "unstarted",
      },
    ],
  });
  await linear.connect("lin_api_secret");
  linear.createSource({ project_id: "p1", ...TEAM });

  const results = await linear.sync();

  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ imported: 1, updated: 0 });
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toHaveLength(1);
  expect(linear.sources()[0]?.last_synced_at).toBe("2026-07-20T12:00:00.000Z");
});
