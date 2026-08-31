import { getSyncState, insertProject, listIssues } from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  createLinearService,
  linearError,
  SYNC_RESOURCE,
  SYNC_SOURCE,
  type LinearIssue,
  type LinearIssueQuery,
  type LinearService,
} from "#linear";

import { setupTestDb, type TestDb } from "../support/db.js";
import { CONNECTION, connectLinear as connect, stubLinearApiClient } from "../support/linear.js";

const VIEWER = { user_name: "Alim", workspace_id: "workspace-1", workspace_name: "Otomat" };
const WORKSPACE = {
  teams: [
    { id: "team-1", key: "OTO", name: "Otomat", states: [] },
    { id: "team-2", key: "ENG", name: "Engineering", states: [] },
  ],
  projects: [],
};
const TEAM = { connection_id: CONNECTION.id, external_team_id: "team-1" };

function uninitializedDeferred(): never {
  throw new Error("Deferred promise did not initialize");
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = uninitializedDeferred;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function linearIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: "linear-uuid-1",
    identifier: "OTO-1",
    title: "Mirror me",
    description: null,
    url: "https://linear.app/otomat/issue/OTO-1",
    updated_at: "2026-07-20T11:00:00.000Z",
    state_type: "unstarted",
    state_name: "Todo",
    state_color: "#888",
    priority: 0,
    assignee_name: null,
    labels: [],
    ...overrides,
  };
}

let t: TestDb;
let ids: number;
let clock: Date;

function service(overrides: Parameters<typeof stubLinearApiClient>[0] = {}): LinearService {
  return createLinearService({
    db: t.db,
    dataDir: t.dir,
    client: stubLinearApiClient({
      viewer: async () => VIEWER,
      workspace: async () => WORKSPACE,
      ...overrides,
    }),
    idFactory: () => `id-${(ids += 1)}`,
    now: () => clock,
  });
}

beforeEach(() => {
  t = setupTestDb("otomat-linear-refresh-");
  ids = 0;
  clock = new Date("2026-07-20T12:00:00.000Z");
});

afterEach(() => {
  t.cleanup();
});

it("imports an issue created on Linear after the first pass", async () => {
  let remote: LinearIssue[] = [];
  const linear = service({ issues: async () => remote });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.sync({ project_id: "p1" });
  expect(listIssues(t.db).filter((issue) => issue.source === SYNC_SOURCE)).toHaveLength(0);

  remote = [linearIssue({ id: "linear-uuid-new", identifier: "OTO-9", title: "Created later" })];
  const results = await linear.sync({ project_id: "p1" });

  expect(results[0]).toMatchObject({ imported: 1, updated: 0 });
  expect(linear.syncStatus("p1")).toMatchObject({
    sources: 1,
    running: false,
    last_result: { imported: 1, updated: 0 },
    last_error: null,
  });
});

it("mirrors a remote field and status change onto the same row", async () => {
  let remote = [linearIssue()];
  const linear = service({ issues: async () => remote });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.sync({ project_id: "p1" });

  remote = [
    linearIssue({ title: "Renamed remotely", state_type: "completed", state_name: "Done" }),
  ];
  const results = await linear.sync({ project_id: "p1" });

  expect(results[0]).toMatchObject({ imported: 0, updated: 1 });
  const mirrored = listIssues(t.db).filter((issue) => issue.source === SYNC_SOURCE);
  expect(mirrored).toHaveLength(1);
  expect(mirrored[0]).toMatchObject({ title: "Renamed remotely", status: "done" });
});

it("collapses concurrent refreshes of one project into a single Linear read", async () => {
  const page = deferred<LinearIssue[]>();
  let reads = 0;
  const linear = service({
    issues: () => {
      reads += 1;
      return page.promise;
    },
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });

  const first = linear.sync({ project_id: "p1" });
  const second = linear.sync({ project_id: "p1" });
  await vi.waitFor(() => expect(reads).toBe(1));
  expect(linear.syncStatus("p1").running).toBe(true);
  page.resolve([linearIssue()]);

  expect(await first).toEqual(await second);
  expect(reads).toBe(1);
  expect(listIssues(t.db).filter((issue) => issue.source === SYNC_SOURCE)).toHaveLength(1);
  expect(linear.syncStatus("p1").running).toBe(false);
});

it("repairs a cursor that drifted past the remote updates it should have caught", async () => {
  const queries: LinearIssueQuery[] = [];
  let remote: LinearIssue[] = [];
  const linear = service({
    issues: async (_apiKey, query) => {
      queries.push(query);
      const since = query.updated_since;
      return since === null ? remote : remote.filter((issue) => issue.updated_at >= since);
    },
  });
  await connect(linear, "lin_api_secret");
  const source = await linear.createSource({ project_id: "p1", ...TEAM });
  // A skewed clock parks the watermark a month ahead of anything Linear will report.
  clock = new Date("2026-08-20T12:00:00.000Z");
  await linear.sync({ project_id: "p1" });

  remote = [linearIssue()];
  await linear.sync({ project_id: "p1" });
  expect(listIssues(t.db).filter((issue) => issue.source === SYNC_SOURCE)).toHaveLength(0);

  const results = await linear.sync({ project_id: "p1", full: true });

  expect(queries.at(-1)?.updated_since).toBeNull();
  expect(results[0]).toMatchObject({ imported: 1 });
  expect(listIssues(t.db).filter((issue) => issue.source === SYNC_SOURCE)).toHaveLength(1);
  // The repair rewinds the watermark in place instead of dropping the cursor row.
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)?.cursor).toBe(
    new Date(Date.parse("2026-07-20T11:00:00.000Z") - 60_000).toISOString(),
  );
});

it("queues a full reconciliation behind the incremental pass it repairs", async () => {
  const firstPage = deferred<LinearIssue[]>();
  const queries: LinearIssueQuery[] = [];
  const linear = service({
    issues: async (_apiKey, query) => {
      queries.push(query);
      return queries.length === 1 ? firstPage.promise : [linearIssue()];
    },
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });

  const incremental = linear.sync({ project_id: "p1" });
  await vi.waitFor(() => expect(queries).toHaveLength(1));
  const reconcile = linear.sync({ project_id: "p1", full: true });
  expect(queries).toHaveLength(1);
  firstPage.resolve([]);

  expect(await incremental).toMatchObject([{ imported: 0 }]);
  expect(await reconcile).toMatchObject([{ imported: 1 }]);
  expect(queries.map((query) => query.updated_since)).toEqual([null, null]);
});

it("keeps every local row a full reconciliation is not allowed to touch", async () => {
  const linear = service({ issues: async () => [linearIssue()] });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.sync({ project_id: "p1" });
  const before = listIssues(t.db).map((issue) => issue.id);

  await linear.sync({ project_id: "p1", full: true });

  expect(listIssues(t.db).map((issue) => issue.id)).toEqual(before);
  expect(linear.sources("p1")).toHaveLength(1);
});

it("reports an expired key as an error instead of a successful refresh", async () => {
  let remote: LinearIssue[] | null = [linearIssue()];
  const linear = service({
    issues: async () => {
      if (remote === null) throw linearError("linear_unauthorized");
      return remote;
    },
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.sync({ project_id: "p1" });
  const fresh = linear.syncStatus("p1").last_synced_at;

  remote = null;
  await expect(linear.sync({ project_id: "p1" })).rejects.toMatchObject({
    code: "linear_unauthorized",
  });

  expect(linear.syncStatus("p1")).toMatchObject({
    running: false,
    last_synced_at: fresh,
    last_error: { code: "linear_unauthorized" },
  });
  expect(linear.connections()[0]).toMatchObject({ status: "failed" });
});

it("clears a recorded failure once a later pass succeeds", async () => {
  let failing = true;
  const linear = service({
    issues: async () => {
      if (failing) throw linearError("linear_unavailable");
      return [linearIssue()];
    },
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await expect(linear.sync({ project_id: "p1" })).rejects.toThrow();
  expect(linear.syncStatus("p1").last_error).toMatchObject({ code: "linear_unavailable" });

  failing = false;
  await linear.sync({ project_id: "p1" });

  expect(linear.syncStatus("p1")).toMatchObject({
    last_error: null,
    last_result: { imported: 1, updated: 0 },
    last_synced_at: "2026-07-20T12:00:00.000Z",
  });
});

it("refuses a project this daemon does not own rather than syncing nothing", async () => {
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(linear.sync({ project_id: "vps-project" })).rejects.toMatchObject({
    code: "linear_project_not_found",
  });
  expect(() => linear.syncStatus("vps-project")).toThrow(
    expect.objectContaining({ code: "linear_project_not_found" }),
  );
});

it("refreshes only the sources of the project it was asked about", async () => {
  insertProject(t.db, { id: "p2", name: "Second", root_path: "/tmp/otomat-p2" });
  const teams: string[] = [];
  const linear = service({
    issues: async (_apiKey, query) => {
      teams.push(query.team_id);
      return [];
    },
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.createSource({
    project_id: "p2",
    connection_id: CONNECTION.id,
    external_team_id: "team-2",
  });

  await linear.sync({ project_id: "p1" });

  expect(teams).toEqual(["team-1"]);
  expect(linear.syncStatus("p2")).toMatchObject({ last_synced_at: null, last_result: null });
});

it("reports a project with no mapped source as unsynced rather than fresh", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  expect(linear.syncStatus("p1")).toMatchObject({
    project_id: "p1",
    sources: 0,
    running: false,
    last_synced_at: null,
    last_result: null,
    last_error: null,
  });
});

it("stays unsynced while one of the project's sources has never landed", async () => {
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");
  const first = await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.createSource({
    project_id: "p1",
    connection_id: CONNECTION.id,
    external_team_id: "team-2",
  });

  await linear.sync({ source_id: first.id });

  expect(linear.syncStatus("p1")).toMatchObject({ sources: 2, last_synced_at: null });
});
