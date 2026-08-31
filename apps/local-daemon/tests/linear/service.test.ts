import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getSyncState,
  insertIssueSource,
  insertProject,
  listIssues,
  listIssueSources,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  createLinearApiClient,
  createLinearService,
  linearError,
  SYNC_RESOURCE,
  SYNC_SOURCE,
  type LinearService,
  type LinearTransport,
  type LinearTransportResponse,
} from "#linear";

import { setupTestDb, type TestDb } from "../support/db.js";
import { CONNECTION, connectLinear as connect, stubLinearApiClient } from "../support/linear.js";

const VIEWER = {
  user_name: "Alim",
  workspace_id: "workspace-1",
  workspace_name: "Otomat",
};

const WORKSPACE = {
  teams: [
    {
      id: "team-1",
      key: "OTO",
      name: "Otomat",
      states: [
        { id: "s-doing", name: "Doing", type: "started" },
        { id: "s-shipped", name: "Shipped", type: "completed" },
      ],
    },
    { id: "team-2", key: "ENG", name: "Engineering", states: [] },
  ],
  projects: [
    { id: "proj-1", name: "V1 Alpha", team_ids: ["team-1"] },
    { id: "proj-2", name: "V2", team_ids: ["team-1"] },
    { id: "platform", name: "Platform", team_ids: ["team-2"] },
  ],
};

const TEAM = {
  connection_id: CONNECTION.id,
  external_team_id: "team-1",
};

function connectionOf(linear: LinearService, id = CONNECTION.id) {
  return linear.connections().find((candidate) => candidate.id === id);
}

const VIEWER_RESPONSE: LinearTransportResponse = {
  status: 200,
  body: {
    data: {
      viewer: { name: "Alim" },
      organization: { id: "workspace-1", name: "Otomat" },
    },
  },
};

function uninitializedDeferred(): never {
  throw new Error("Deferred promise did not initialize");
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = uninitializedDeferred;
  let rejectPromise: (error: unknown) => void = uninitializedDeferred;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

let t: TestDb;
let ids: number;

function service(overrides: Parameters<typeof stubLinearApiClient>[0] = {}): LinearService {
  return createLinearService({
    db: t.db,
    dataDir: t.dir,
    client: stubLinearApiClient({
      viewer: async () => VIEWER,
      workspace: async () => WORKSPACE,
      ...overrides,
    }),
    idFactory: () => `src-${(ids += 1)}`,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
  });
}

function serviceWithTransport(transport: LinearTransport): LinearService {
  return createLinearService({
    db: t.db,
    dataDir: t.dir,
    client: createLinearApiClient(transport),
    idFactory: () => `src-${(ids += 1)}`,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
  });
}

/** Every file the daemon wrote — the database and its write-ahead log alike — that carries `secret`. */
function dataDirHolding(secret: string): string[] {
  return readdirSync(t.dir).filter((name) =>
    readFileSync(join(t.dir, name)).includes(Buffer.from(secret)),
  );
}

function persistSource(source: "linear" | "github" = "linear") {
  const id = `src-${(ids += 1)}`;
  insertIssueSource(t.db, {
    id,
    project_id: "p1",
    connection_id: CONNECTION.id,
    source,
    external_team_id: "team-1",
    external_team_key: "OTO",
    external_team_name: "Otomat",
  });
  return { id };
}

beforeEach(() => {
  t = setupTestDb("otomat-linear-service-");
  ids = 0;
});

afterEach(() => {
  t.cleanup();
});

it("starts with an empty catalogue and reports the workspace once connected", async () => {
  const linear = service();

  expect(linear.connections()).toEqual([]);
  const connection = await connect(linear, "lin_api_secret");

  expect(connection).toEqual({
    id: CONNECTION.id,
    label: CONNECTION.label,
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
    user_name: "Alim",
    error_code: null,
    error_message: null,
  });
  expect(JSON.stringify(connection)).not.toContain("lin_api_secret");
});

it("refuses a rejected key and catalogues nothing", async () => {
  const linear = service({
    viewer: async () => {
      throw linearError("linear_unauthorized");
    },
  });

  await expect(connect(linear, "bad-key")).rejects.toMatchObject({ code: "linear_unauthorized" });

  expect(linear.connections()).toEqual([]);
  await expect(linear.workspace(CONNECTION.id)).rejects.toMatchObject({
    code: "linear_connection_not_found",
  });
});

it("does not hide an unexpected connection failure", async () => {
  const linear = service({
    viewer: async () => {
      throw new Error("unexpected failure");
    },
  });

  await expect(connect(linear, "lin_api_secret")).rejects.toThrow("unexpected failure");
  expect(linear.connections()).toEqual([]);
});

it("does not keep a stale connected state after an unexpected reconnect failure", async () => {
  let attempts = 0;
  const linear = service({
    viewer: async () => {
      attempts += 1;
      if (attempts === 1) return VIEWER;
      throw new Error("unexpected failure");
    },
  });
  await connect(linear, "first-key");

  await expect(connect(linear, "second-key")).rejects.toThrow("unexpected failure");

  expect(connectionOf(linear)?.status).toBe("disconnected");
  await expect(linear.workspace(CONNECTION.id)).rejects.toMatchObject({
    code: "linear_not_connected",
  });
});

it("removes the connection and its mappings on disconnect", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });

  linear.disconnect(CONNECTION.id);

  expect(linear.connections()).toEqual([]);
  expect(linear.sources()).toEqual([]);
  await expect(linear.workspace(CONNECTION.id)).rejects.toMatchObject({
    code: "linear_connection_not_found",
  });
});

it("drops a connection whose key was revoked mid-use", async () => {
  const linear = service({
    workspace: async () => {
      throw linearError("linear_unauthorized");
    },
  });
  await connect(linear, "lin_api_secret");

  await expect(linear.workspace(CONNECTION.id)).rejects.toMatchObject({
    code: "linear_unauthorized",
  });
  expect(connectionOf(linear)).toMatchObject({
    status: "failed",
    error_code: "linear_unauthorized",
  });
});

it("does not return data from an obsolete authorized request", async () => {
  const workspaceRequest = deferred<{ teams: []; projects: [] }>();
  const linear = service({
    workspace: () => workspaceRequest.promise,
  });
  await connect(linear, "first-key");
  const obsoleteRequest = linear.workspace(CONNECTION.id);

  await connect(linear, "replacement-key");
  workspaceRequest.resolve({ teams: [], projects: [] });

  await expect(obsoleteRequest).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(connectionOf(linear)).toMatchObject({ status: "connected" });
});

it("rejects an obsolete connect instead of returning the winning connection", async () => {
  const firstViewer = deferred<typeof VIEWER>();
  const secondViewer = deferred<typeof VIEWER>();
  let workspaceKey: string | null = null;
  const linear = service({
    viewer: (apiKey) => (apiKey === "first-key" ? firstViewer.promise : secondViewer.promise),
    workspace: async (apiKey) => {
      workspaceKey = apiKey;
      return { teams: [], projects: [] };
    },
  });

  const firstConnect = connect(linear, "first-key");
  const secondConnect = connect(linear, "second-key");
  secondViewer.resolve({
    user_name: "Second",
    workspace_id: "workspace-2",
    workspace_name: "Second workspace",
  });
  await expect(secondConnect).resolves.toMatchObject({
    status: "connected",
    workspace_name: "Second workspace",
  });
  firstViewer.resolve(VIEWER);

  await expect(firstConnect).rejects.toMatchObject({ code: "linear_request_superseded" });
  await linear.workspace(CONNECTION.id);
  expect(workspaceKey).toBe("second-key");
});

it("maps a source onto an existing local project and refuses a duplicate", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  const source = await linear.createSource({ project_id: "p1", ...TEAM });

  expect(source).toMatchObject({
    project_id: "p1",
    source: "linear",
    external_team_key: "OTO",
    external_project_id: "",
    last_synced_at: null,
  });
  await expect(linear.createSource({ project_id: "p1", ...TEAM })).rejects.toMatchObject({
    code: "linear_source_already_mapped",
  });
  expect(linear.sources()).toHaveLength(1);
});

it("stores a lifecycle mapping picked from the source's own team workflow", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");
  const created = await linear.createSource({ project_id: "p1", ...TEAM });
  expect(created.lifecycle).toEqual({ in_progress: null, done: null });

  const mapped = await linear.updateSource(created.id, {
    in_progress_state_id: "s-doing",
    done_state_id: "s-shipped",
  });

  expect(mapped.lifecycle).toEqual({
    in_progress: { id: "s-doing", name: "Doing" },
    done: { id: "s-shipped", name: "Shipped" },
  });
  expect(linear.sources()[0]?.lifecycle.done).toEqual({ id: "s-shipped", name: "Shipped" });

  const cleared = await linear.updateSource(created.id, {
    in_progress_state_id: "s-doing",
    done_state_id: null,
  });
  expect(cleared.lifecycle.done).toBeNull();
});

it("refuses a state whose Linear type does not carry the phase", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");
  const created = await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(
    linear.updateSource(created.id, {
      in_progress_state_id: "s-shipped",
      done_state_id: "s-doing",
    }),
  ).rejects.toMatchObject({ code: "linear_source_state_invalid" });
  expect(linear.sources()[0]?.lifecycle).toEqual({ in_progress: null, done: null });
});

it("refuses a lifecycle state that belongs to another team, and an unknown source", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");
  const created = await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(
    linear.updateSource(created.id, {
      in_progress_state_id: "s-foreign",
      done_state_id: null,
    }),
  ).rejects.toMatchObject({ code: "linear_source_state_invalid" });
  await expect(
    linear.updateSource("src-nope", { in_progress_state_id: null, done_state_id: null }),
  ).rejects.toMatchObject({ code: "linear_source_not_found" });
  expect(linear.sources()[0]?.lifecycle.in_progress).toBeNull();
});

it("refuses a source pointing at a project that does not exist locally", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  await expect(linear.createSource({ project_id: "missing", ...TEAM })).rejects.toMatchObject({
    code: "linear_project_not_found",
  });
});

it("allows non-overlapping Linear projects from the same team", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  await linear.createSource({
    project_id: "p1",
    ...TEAM,
    external_project_id: "proj-1",
  });
  await linear.createSource({
    project_id: "p1",
    ...TEAM,
    external_project_id: "proj-2",
  });

  expect(linear.sources().map((source) => source.external_project_name)).toEqual([
    "V1 Alpha",
    "V2",
  ]);
});

it("refuses overlapping whole-team and project mappings", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(
    linear.createSource({
      project_id: "p1",
      ...TEAM,
      external_project_id: "proj-1",
    }),
  ).rejects.toMatchObject({ code: "linear_source_already_mapped" });

  const otherTeam = {
    connection_id: CONNECTION.id,
    external_team_id: "team-2",
  };
  await linear.createSource({
    project_id: "p1",
    ...otherTeam,
    external_project_id: "platform",
  });

  await expect(linear.createSource({ project_id: "p1", ...otherTeam })).rejects.toMatchObject({
    code: "linear_source_already_mapped",
  });
});

it("derives source labels from the authenticated workspace", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  const source = await linear.createSource({
    project_id: "p1",
    connection_id: CONNECTION.id,
    external_team_id: "team-1",
    external_project_id: "proj-1",
  });

  expect(source).toMatchObject({
    source: "linear",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    external_project_name: "V1 Alpha",
  });
});

it("rejects a team or project outside the authenticated workspace", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  await expect(
    linear.createSource({
      project_id: "p1",
      connection_id: CONNECTION.id,
      external_team_id: "foreign-team",
    }),
  ).rejects.toMatchObject({ code: "linear_source_invalid_selection" });
  await expect(
    linear.createSource({
      project_id: "p1",
      connection_id: CONNECTION.id,
      external_team_id: "team-2",
      external_project_id: "proj-1",
    }),
  ).rejects.toMatchObject({ code: "linear_source_invalid_selection" });
});

it("lists and syncs only Linear mappings", async () => {
  const linearSource = persistSource();
  const githubSource = persistSource("github");
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");

  expect(linear.sources().map((source) => source.id)).toEqual([linearSource.id]);
  await expect(linear.sync({ source_id: githubSource.id })).rejects.toMatchObject({
    code: "linear_source_not_found",
  });
});

it("does not persist a source after its workspace request is superseded", async () => {
  const workspaceRequest = deferred<typeof WORKSPACE>();
  const linear = service({ workspace: () => workspaceRequest.promise });
  await connect(linear, "lin_api_secret");
  const creation = linear.createSource({ project_id: "p1", ...TEAM });

  workspaceRequest.resolve(WORKSPACE);
  queueMicrotask(() => void connect(linear, "replacement-key"));

  await expect(creation).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(listIssueSources(t.db, "linear")).toEqual([]);
});

it("refuses to sync an unknown source", async () => {
  const linear = service();
  await connect(linear, "lin_api_secret");

  await expect(linear.sync({ source_id: "missing" })).rejects.toMatchObject({
    code: "linear_source_not_found",
  });
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
        state_name: "Todo",
        state_color: "#888",
        priority: 0,
        assignee_name: null,
        labels: [],
      },
    ],
  });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });

  const results = await linear.sync();

  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ imported: 1, updated: 0 });
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toHaveLength(1);
  expect(linear.sources()[0]?.last_synced_at).toBe("2026-07-20T12:00:00.000Z");
});

it("rejects a malformed Linear issue before writing rows or a cursor", async () => {
  const responses: LinearTransportResponse[] = [
    VIEWER_RESPONSE,
    {
      status: 200,
      body: {
        data: {
          issues: {
            nodes: [
              {
                id: "linear-uuid-1",
                identifier: "OTO-1",
                title: "Malformed",
                description: null,
                url: "not-a-url",
                updatedAt: "2026-07-20T10:00:00.000Z",
                state: { type: "started" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  ];
  const linear = serviceWithTransport(async () => {
    const response = responses.shift();
    if (response === undefined) throw new Error("Unexpected Linear request");
    return response;
  });
  await connect(linear, "lin_api_secret");
  const source = persistSource();

  await expect(linear.sync()).rejects.toMatchObject({ code: "linear_request_failed" });

  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toEqual([]);
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeUndefined();
});

it("cancels an obsolete paginated sync before another page or any write", async () => {
  const firstIssuePage = deferred<LinearTransportResponse>();
  let issueRequests = 0;
  const linear = serviceWithTransport(async (request) => {
    if (request.query.includes("OtomatViewer")) {
      return VIEWER_RESPONSE;
    }
    if (request.query.includes("OtomatIssues")) {
      issueRequests += 1;
      if (issueRequests === 1) return firstIssuePage.promise;
      throw new Error("The obsolete sync requested another page");
    }
    throw new Error("Unexpected Linear request");
  });
  await connect(linear, "first-key");
  const source = persistSource();
  const obsoleteSync = linear.sync();
  await vi.waitFor(() => expect(issueRequests).toBe(1));

  await connect(linear, "replacement-key");
  firstIssuePage.resolve({
    status: 200,
    body: {
      data: {
        issues: {
          nodes: [
            {
              id: "linear-uuid-1",
              identifier: "OTO-1",
              title: "Do not persist",
              description: null,
              url: "https://linear.app/otomat/issue/OTO-1",
              updatedAt: "2026-07-20T10:00:00.000Z",
              state: { type: "started" },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "page-2" },
        },
      },
    },
  });

  await expect(obsoleteSync).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(issueRequests).toBe(1);
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toEqual([]);
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeUndefined();
});

it("cancels sibling operations when one discovers a revoked key", async () => {
  const firstIssuePage = deferred<LinearTransportResponse>();
  let issueRequests = 0;
  const linear = serviceWithTransport(async (request) => {
    if (request.query.includes("OtomatViewer")) {
      return VIEWER_RESPONSE;
    }
    if (request.query.includes("OtomatIssues")) {
      issueRequests += 1;
      if (issueRequests === 1) return firstIssuePage.promise;
      throw new Error("The canceled sync requested another page");
    }
    if (request.query.includes("OtomatTeams")) {
      return {
        status: 401,
        body: { errors: [{ extensions: { code: "AUTHENTICATION_ERROR" } }] },
      };
    }
    throw new Error("Unexpected Linear request");
  });
  await connect(linear, "revoked-key");
  const source = persistSource();
  const siblingSync = linear.sync();
  await vi.waitFor(() => expect(issueRequests).toBe(1));

  await expect(linear.workspace(CONNECTION.id)).rejects.toMatchObject({
    code: "linear_unauthorized",
  });
  firstIssuePage.resolve({
    status: 200,
    body: {
      data: {
        issues: {
          nodes: [
            {
              id: "linear-uuid-1",
              identifier: "OTO-1",
              title: "Do not persist",
              description: null,
              url: "https://linear.app/otomat/issue/OTO-1",
              updatedAt: "2026-07-20T10:00:00.000Z",
              state: { type: "started" },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "page-2" },
        },
      },
    },
  });

  await expect(siblingSync).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(connectionOf(linear)).toMatchObject({
    status: "failed",
    error_code: "linear_unauthorized",
  });
  expect(issueRequests).toBe(1);
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toEqual([]);
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeUndefined();
});

it("scopes source listing and sync to a single project when asked", async () => {
  insertProject(t.db, { id: "p2", name: "Second", root_path: "/tmp/otomat-p2" });
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");
  await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.createSource({
    project_id: "p2",
    connection_id: CONNECTION.id,
    external_team_id: "team-2",
  });

  expect(linear.sources()).toHaveLength(2);
  expect(linear.sources("p1").map((source) => source.project_id)).toEqual(["p1"]);

  const results = await linear.sync({ project_id: "p2" });
  expect(results).toHaveLength(1);
});

it("unmaps a source, drops its cursor, and frees the team for a new mapping", async () => {
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");
  const source = await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.sync({ source_id: source.id });
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeDefined();

  linear.deleteSource(source.id);

  expect(linear.sources()).toHaveLength(0);
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeUndefined();
  expect(() => linear.deleteSource(source.id)).toThrow(
    expect.objectContaining({ code: "linear_source_not_found" }),
  );
  await expect(linear.createSource({ project_id: "p1", ...TEAM })).resolves.toMatchObject({
    external_team_id: "team-1",
  });
});

it("refuses to unmap a non-Linear source", async () => {
  const githubSource = persistSource("github");
  const linear = service();
  await connect(linear, "lin_api_secret");

  expect(() => linear.deleteSource(githubSource.id)).toThrow(
    expect.objectContaining({ code: "linear_source_not_found" }),
  );
});

it("feeds two projects from one connection, each keeping its own selection", async () => {
  insertProject(t.db, { id: "p2", name: "Back", root_path: "/tmp/otomat-p2" });
  const linear = service({
    issues: async (_apiKey, query) => [
      {
        id: `uuid-${query.project_id ?? query.team_id}`,
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
      },
    ],
  });
  await connect(linear, "lin_api_secret");
  const front = await linear.createSource({
    project_id: "p1",
    ...TEAM,
    external_project_id: "proj-1",
  });
  const back = await linear.createSource({
    project_id: "p2",
    ...TEAM,
    external_project_id: "proj-2",
  });

  await linear.updateSource(front.id, { in_progress_state_id: "s-doing", done_state_id: null });
  await linear.updateSource(back.id, { in_progress_state_id: null, done_state_id: "s-shipped" });

  expect(linear.sources("p1").map((source) => source.external_project_name)).toEqual(["V1 Alpha"]);
  expect(linear.sources("p2").map((source) => source.external_project_name)).toEqual(["V2"]);
  expect(linear.sources("p1")[0]?.lifecycle).toEqual({
    in_progress: { id: "s-doing", name: "Doing" },
    done: null,
  });
  expect(linear.sources("p2")[0]?.lifecycle).toEqual({
    in_progress: null,
    done: { id: "s-shipped", name: "Shipped" },
  });

  await linear.sync({ project_id: "p1" });

  expect(listIssues(t.db).map((issue) => issue.project_id)).toEqual(["p1", "p1"]);
});

it("never writes the key to the database it imports into", async () => {
  const linear = service({ issues: async () => [] });
  await connect(linear, "lin_api_secret");
  const source = await linear.createSource({ project_id: "p1", ...TEAM });
  await linear.updateSource(source.id, { in_progress_state_id: "s-doing", done_state_id: null });
  await linear.sync();
  linear.disconnect(CONNECTION.id);

  expect(dataDirHolding("lin_api_secret")).toEqual([]);
});

it("keeps two projects on two connections apart, and one revocation local to its own", async () => {
  insertProject(t.db, { id: "p2", name: "CRM", root_path: "/tmp/otomat-crm" });
  const keysUsed: string[] = [];
  const linear = service({
    viewer: async (apiKey) => ({ ...VIEWER, workspace_id: `workspace-${apiKey}` }),
    workspace: async (apiKey) => {
      if (apiKey === "crm-key") throw linearError("linear_unauthorized");
      return WORKSPACE;
    },
    issues: async (apiKey, query) => {
      keysUsed.push(apiKey);
      return [
        {
          id: `uuid-${query.team_id}`,
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
        },
      ];
    },
  });
  await connect(linear, "otomat-key");
  await connect(linear, "crm-key", "c-crm");
  await linear.createSource({ project_id: "p1", ...TEAM });
  insertIssueSource(t.db, {
    id: "src-crm",
    project_id: "p2",
    connection_id: "c-crm",
    source: "linear",
    external_team_id: "team-9",
    external_team_key: "CRM",
    external_team_name: "Avest",
  });

  await linear.sync({ project_id: "p1" });
  await linear.sync({ project_id: "p2" });

  expect(keysUsed).toEqual(["otomat-key", "crm-key"]);
  expect(linear.sources("p1").map((source) => source.connection_id)).toEqual([CONNECTION.id]);
  expect(linear.sources("p2").map((source) => source.connection_id)).toEqual(["c-crm"]);

  // The CRM key is revoked mid-use; the Otomat project must keep working.
  await expect(linear.workspace("c-crm")).rejects.toMatchObject({ code: "linear_unauthorized" });

  expect(connectionOf(linear, "c-crm")).toMatchObject({ status: "failed" });
  expect(connectionOf(linear)).toMatchObject({ status: "connected" });
  await expect(linear.sync({ project_id: "p1" })).resolves.toHaveLength(1);
  await expect(linear.sync({ project_id: "p2" })).rejects.toMatchObject({
    code: "linear_not_connected",
  });
  expect(linear.syncStatus("p2").connection).toMatchObject({ status: "failed" });
});

it("refuses a second connection's team on a project already reading another", async () => {
  const linear = service();
  await connect(linear, "otomat-key");
  await connect(linear, "crm-key", "c-crm");
  await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(
    linear.createSource({
      project_id: "p1",
      connection_id: "c-crm",
      external_team_id: "team-2",
    }),
  ).rejects.toMatchObject({ code: "linear_connection_mismatch" });
});
