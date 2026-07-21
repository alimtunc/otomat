import { expect, it } from "vitest";

import {
  createLinearApiClient,
  LinearError,
  type LinearTransport,
  type LinearTransportRequest,
  type LinearTransportResponse,
} from "#linear";

const KEY = "lin_api_secret";

function ok(data: unknown): LinearTransportResponse {
  return { status: 200, body: { data } };
}

function fakeTransport(responses: LinearTransportResponse[]): {
  requests: LinearTransportRequest[];
  transport: LinearTransport;
} {
  const requests: LinearTransportRequest[] = [];
  const queue = [...responses];
  return {
    requests,
    transport: async (request) => {
      requests.push(request);
      const next = queue.shift();
      if (next === undefined) throw new Error("unexpected Linear request");
      return next;
    },
  };
}

function issuePage(
  ids: string[],
  hasNextPage: boolean,
  endCursor: string | null,
  overrides: Record<string, unknown> = {},
) {
  return ok({
    issues: {
      nodes: ids.map((id) => ({
        id,
        identifier: `OTO-${id}`,
        title: `Issue ${id}`,
        description: null,
        url: `https://linear.app/otomat/issue/OTO-${id}`,
        updatedAt: "2026-07-20T10:00:00.000Z",
        state: { type: "started" },
        ...overrides,
      })),
      pageInfo: { hasNextPage, endCursor },
    },
  });
}

it("reads the viewer and workspace identity", async () => {
  const fake = fakeTransport([
    ok({ viewer: { name: "Alim" }, organization: { id: "workspace-1", name: "Otomat" } }),
  ]);

  const viewer = await createLinearApiClient(fake.transport).viewer(KEY);

  expect(viewer).toEqual({
    user_name: "Alim",
    workspace_id: "workspace-1",
    workspace_name: "Otomat",
  });
  expect(fake.requests[0]?.apiKey).toBe(KEY);
});

it("follows nested project team pages", async () => {
  const fake = fakeTransport([
    ok({
      teams: {
        nodes: [
          { id: "team-1", key: "ONE", name: "One" },
          { id: "team-101", key: "LATE", name: "Late" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    ok({
      projects: {
        nodes: [
          {
            id: "project-1",
            name: "Shared",
            teams: {
              nodes: [{ id: "team-1" }],
              pageInfo: { hasNextPage: true, endCursor: "team-page-1" },
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    ok({
      project: {
        teams: {
          nodes: [{ id: "team-101" }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    }),
  ]);

  const workspace = await createLinearApiClient(fake.transport).workspace(KEY);

  expect(workspace.projects[0]?.team_ids).toEqual(["team-1", "team-101"]);
  expect(fake.requests[1]).toMatchObject({ variables: { first: 100, teamFirst: 25 } });
  expect(fake.requests[2]).toMatchObject({
    variables: { projectId: "project-1", after: "team-page-1", first: 100 },
  });
});

it("rejects a repeated nested project team cursor without replaying it", async () => {
  const fake = fakeTransport([
    ok({
      teams: {
        nodes: [{ id: "team-1", key: "ONE", name: "One" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    ok({
      projects: {
        nodes: [
          {
            id: "project-1",
            name: "Shared",
            teams: {
              nodes: [{ id: "team-1" }],
              pageInfo: { hasNextPage: true, endCursor: "repeated-team-cursor" },
            },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),
    ok({
      project: {
        teams: {
          nodes: [{ id: "team-2" }],
          pageInfo: { hasNextPage: true, endCursor: "repeated-team-cursor" },
        },
      },
    }),
  ]);

  await expect(createLinearApiClient(fake.transport).workspace(KEY)).rejects.toMatchObject({
    code: "linear_request_failed",
  });
  expect(fake.requests).toHaveLength(3);
});

it.each([
  ["an empty immutable id", { id: "" }],
  ["an empty human identifier", { identifier: "" }],
  ["an empty title", { title: "" }],
  ["an invalid URL", { url: "not-a-url" }],
  ["an invalid update timestamp", { updatedAt: "yesterday" }],
])("rejects an issue with %s", async (_description, overrides) => {
  const fake = fakeTransport([issuePage(["1"], false, null, overrides)]);

  await expect(
    createLinearApiClient(fake.transport).issues(KEY, {
      team_id: "team-1",
      project_id: "",
      updated_since: null,
    }),
  ).rejects.toMatchObject({ code: "linear_request_failed" });
});

it("follows every page of issues before returning", async () => {
  const fake = fakeTransport([
    issuePage(["1", "2"], true, "cursor-1"),
    issuePage(["3"], false, null),
  ]);

  const issues = await createLinearApiClient(fake.transport).issues(KEY, {
    team_id: "team-1",
    project_id: "",
    updated_since: null,
  });

  expect(issues.map((issue) => issue.id)).toEqual(["1", "2", "3"]);
  expect(fake.requests[0]?.variables.after).toBeNull();
  expect(fake.requests[1]?.variables.after).toBe("cursor-1");
});

it("rejects a page that claims another page without providing its cursor", async () => {
  const fake = fakeTransport([issuePage(["1"], true, null)]);

  await expect(
    createLinearApiClient(fake.transport).issues(KEY, {
      team_id: "team-1",
      project_id: "",
      updated_since: null,
    }),
  ).rejects.toMatchObject({ code: "linear_request_failed" });
});

it("rejects a repeated pagination cursor without replaying it", async () => {
  const fake = fakeTransport([
    issuePage(["1"], true, "repeated-cursor"),
    issuePage(["2"], true, "repeated-cursor"),
  ]);

  await expect(
    createLinearApiClient(fake.transport).issues(KEY, {
      team_id: "team-1",
      project_id: "",
      updated_since: null,
    }),
  ).rejects.toMatchObject({ code: "linear_request_failed" });
  expect(fake.requests).toHaveLength(2);
});

it("filters by team, by project and by an inclusive updated watermark", async () => {
  const fake = fakeTransport([issuePage([], false, null), issuePage([], false, null)]);
  const client = createLinearApiClient(fake.transport);

  await client.issues(KEY, { team_id: "team-1", project_id: "", updated_since: null });
  await client.issues(KEY, {
    team_id: "team-1",
    project_id: "proj-1",
    updated_since: "2026-07-19T00:00:00.000Z",
  });

  expect(fake.requests[0]?.variables.filter).toEqual({ team: { id: { eq: "team-1" } } });
  expect(fake.requests[1]?.variables.filter).toEqual({
    team: { id: { eq: "team-1" } },
    project: { id: { eq: "proj-1" } },
    updatedAt: { gte: "2026-07-19T00:00:00.000Z" },
  });
});

it("reports a rate limit from the body code, not the HTTP status", async () => {
  const fake = fakeTransport([
    { status: 400, body: { errors: [{ extensions: { code: "RATELIMITED" } }] } },
  ]);

  await expect(createLinearApiClient(fake.transport).viewer(KEY)).rejects.toMatchObject({
    code: "linear_rate_limited",
  });
});

it("reports a rejected key as unauthorized", async () => {
  const fake = fakeTransport([
    {
      status: 401,
      body: { errors: [{ extensions: { code: "AUTHENTICATION_ERROR" } }] },
    },
  ]);

  await expect(createLinearApiClient(fake.transport).viewer(KEY)).rejects.toMatchObject({
    code: "linear_unauthorized",
  });
});

it("rejects a partially failed 200 instead of mirroring half a page", async () => {
  const fake = fakeTransport([
    {
      status: 200,
      body: { data: { issues: { nodes: [], pageInfo: {} } }, errors: [{ extensions: {} }] },
    },
  ]);

  await expect(
    createLinearApiClient(fake.transport).issues(KEY, {
      team_id: "team-1",
      project_id: "",
      updated_since: null,
    }),
  ).rejects.toMatchObject({ code: "linear_request_failed" });
});

const offlineTransport: LinearTransport = async () => {
  throw new Error("getaddrinfo ENOTFOUND api.linear.app");
};

it("does not hide an unexpected transport failure", async () => {
  await expect(createLinearApiClient(offlineTransport).viewer(KEY)).rejects.toThrow(
    "getaddrinfo ENOTFOUND api.linear.app",
  );
});

it("never puts the API key in an error it raises", async () => {
  const fake = fakeTransport([
    { status: 401, body: { errors: [{ extensions: { code: "AUTH" } }] } },
  ]);

  const error = await createLinearApiClient(fake.transport)
    .viewer(KEY)
    .catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(LinearError);
  if (!(error instanceof Error)) throw new Error("expected an Error");
  expect(JSON.stringify({ message: error.message })).not.toContain(KEY);
  expect(error.stack ?? "").not.toContain(KEY);
});
