import { getSyncState, insertIssueSource, listIssues, listIssueSources } from "@otomat/db";
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
import { stubLinearApiClient } from "../support/linear.js";

const VIEWER = {
  user_name: "Alim",
  workspace_id: "workspace-1",
  workspace_name: "Otomat",
};

const WORKSPACE = {
  teams: [
    { id: "team-1", key: "OTO", name: "Otomat" },
    { id: "team-2", key: "ENG", name: "Engineering" },
  ],
  projects: [
    { id: "proj-1", name: "V1 Alpha", team_ids: ["team-1"] },
    { id: "proj-2", name: "V2", team_ids: ["team-1"] },
    { id: "platform", name: "Platform", team_ids: ["team-2"] },
  ],
};

const TEAM = {
  external_team_id: "team-1",
};

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
    client: createLinearApiClient(transport),
    idFactory: () => `src-${(ids += 1)}`,
    now: () => new Date("2026-07-20T12:00:00.000Z"),
  });
}

function persistSource(source: "linear" | "github" = "linear"): { id: string } {
  const id = `src-${(ids += 1)}`;
  insertIssueSource(t.db, {
    id,
    project_id: "p1",
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

it("starts disconnected and reports the workspace once connected", async () => {
  const linear = service();

  expect(linear.connection().status).toBe("disconnected");
  const connection = await linear.connect("lin_api_secret");

  expect(connection).toEqual({
    status: "connected",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
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

it("does not hide an unexpected connection failure", async () => {
  const linear = service({
    viewer: async () => {
      throw new Error("unexpected failure");
    },
  });

  await expect(linear.connect("lin_api_secret")).rejects.toThrow("unexpected failure");
  await expect(linear.sync()).rejects.toMatchObject({ code: "linear_not_connected" });
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
  await linear.connect("first-key");

  await expect(linear.connect("second-key")).rejects.toThrow("unexpected failure");

  expect(linear.connection().status).toBe("disconnected");
  await expect(linear.workspace()).rejects.toMatchObject({ code: "linear_not_connected" });
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

it("does not return data from an obsolete authorized request", async () => {
  const workspaceRequest = deferred<{ teams: []; projects: [] }>();
  const linear = service({
    workspace: () => workspaceRequest.promise,
  });
  await linear.connect("first-key");
  const obsoleteRequest = linear.workspace();

  linear.disconnect();
  await linear.connect("replacement-key");
  workspaceRequest.resolve({ teams: [], projects: [] });

  await expect(obsoleteRequest).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(linear.connection()).toMatchObject({ status: "connected" });
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

  const firstConnect = linear.connect("first-key");
  const secondConnect = linear.connect("second-key");
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
  await linear.workspace();
  expect(workspaceKey).toBe("second-key");
});

it("maps a source onto an existing local project and refuses a duplicate", async () => {
  const linear = service();
  await linear.connect("lin_api_secret");

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

it("refuses a source pointing at a project that does not exist locally", async () => {
  const linear = service();
  await linear.connect("lin_api_secret");

  await expect(linear.createSource({ project_id: "missing", ...TEAM })).rejects.toMatchObject({
    code: "linear_project_not_found",
  });
});

it("allows non-overlapping Linear projects from the same team", async () => {
  const linear = service();
  await linear.connect("lin_api_secret");

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
  await linear.connect("lin_api_secret");

  await linear.createSource({ project_id: "p1", ...TEAM });

  await expect(
    linear.createSource({
      project_id: "p1",
      ...TEAM,
      external_project_id: "proj-1",
    }),
  ).rejects.toMatchObject({ code: "linear_source_already_mapped" });

  const otherTeam = {
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
  await linear.connect("lin_api_secret");

  const source = await linear.createSource({
    project_id: "p1",
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
  await linear.connect("lin_api_secret");

  await expect(
    linear.createSource({ project_id: "p1", external_team_id: "foreign-team" }),
  ).rejects.toMatchObject({ code: "linear_source_invalid_selection" });
  await expect(
    linear.createSource({
      project_id: "p1",
      external_team_id: "team-2",
      external_project_id: "proj-1",
    }),
  ).rejects.toMatchObject({ code: "linear_source_invalid_selection" });
});

it("lists and syncs only Linear mappings", async () => {
  const linearSource = persistSource();
  const githubSource = persistSource("github");
  const linear = service({ issues: async () => [] });
  await linear.connect("lin_api_secret");

  expect(linear.sources().map((source) => source.id)).toEqual([linearSource.id]);
  await expect(linear.sync(githubSource.id)).rejects.toMatchObject({
    code: "linear_source_not_found",
  });
});

it("does not persist a source after its workspace request is superseded", async () => {
  const workspaceRequest = deferred<typeof WORKSPACE>();
  const linear = service({ workspace: () => workspaceRequest.promise });
  await linear.connect("lin_api_secret");
  const creation = linear.createSource({ project_id: "p1", ...TEAM });

  workspaceRequest.resolve(WORKSPACE);
  queueMicrotask(() => linear.disconnect());

  await expect(creation).rejects.toMatchObject({ code: "linear_request_superseded" });
  expect(listIssueSources(t.db, { source: "linear" })).toEqual([]);
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
  await linear.connect("lin_api_secret");
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
  await linear.connect("first-key");
  const source = persistSource();
  const obsoleteSync = linear.sync();
  await vi.waitFor(() => expect(issueRequests).toBe(1));

  linear.disconnect();
  await linear.connect("replacement-key");
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
  await linear.connect("revoked-key");
  const source = persistSource();
  const siblingSync = linear.sync();
  await vi.waitFor(() => expect(issueRequests).toBe(1));

  await expect(linear.workspace()).rejects.toMatchObject({ code: "linear_unauthorized" });
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
  expect(linear.connection()).toMatchObject({
    status: "failed",
    error_code: "linear_unauthorized",
  });
  expect(issueRequests).toBe(1);
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toEqual([]);
  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, source.id)).toBeUndefined();
});
