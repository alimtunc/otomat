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
  return { status: 200, headers: {}, body: { data } };
}

/** Shifts one scripted response per call and records the request, like the gh CLI fake runner. */
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

function issuePage(ids: string[], hasNextPage: boolean, endCursor: string | null) {
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
      })),
      pageInfo: { hasNextPage, endCursor },
    },
  });
}

it("reads the viewer and workspace identity", async () => {
  const fake = fakeTransport([
    ok({ viewer: { name: "Alim" }, organization: { name: "Otomat", urlKey: "otomat" } }),
  ]);

  const viewer = await createLinearApiClient(fake.transport).viewer(KEY);

  expect(viewer).toEqual({
    user_name: "Alim",
    workspace_name: "Otomat",
    workspace_url_key: "otomat",
  });
  expect(fake.requests[0]?.apiKey).toBe(KEY);
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
    // `gte`, not `gt`: bulk edits share a millisecond and must not be dropped.
    updatedAt: { gte: "2026-07-19T00:00:00.000Z" },
  });
});

it("reports a rate limit from the body code, not the HTTP status", async () => {
  const fake = fakeTransport([
    { status: 400, headers: {}, body: { errors: [{ extensions: { code: "RATELIMITED" } }] } },
  ]);

  await expect(createLinearApiClient(fake.transport).viewer(KEY)).rejects.toMatchObject({
    code: "linear_rate_limited",
  });
});

it("reports a rejected key as unauthorized", async () => {
  const fake = fakeTransport([
    {
      status: 401,
      headers: {},
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
      headers: {},
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

it("treats a transport fault as unavailable so offline reads stay recoverable", async () => {
  await expect(createLinearApiClient(offlineTransport).viewer(KEY)).rejects.toMatchObject({
    code: "linear_unavailable",
  });
});

it("never puts the API key in an error it raises", async () => {
  const fake = fakeTransport([
    { status: 401, headers: {}, body: { errors: [{ extensions: { code: "AUTH" } }] } },
  ]);

  const error = await createLinearApiClient(fake.transport)
    .viewer(KEY)
    .catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(LinearError);
  expect(JSON.stringify({ message: (error as Error).message })).not.toContain(KEY);
  expect((error as Error).stack ?? "").not.toContain(KEY);
});
