import { insertIssueSource, insertProject, saveLinearConnection, schema } from "@otomat/db";
import { afterEach, expect, it } from "vitest";

import { createLinearApiClient, createLinearService, type LinearTransportRequest } from "#linear";
import { setupTestDb, type TestDb } from "#test-support/db";
import { connectLinear, stubLinearApiClient } from "#test-support/linear";

function neighbor(id: string) {
  return {
    id,
    identifier: id,
    title: id,
    url: `https://linear.app/test/issue/${id}`,
    state: { id: "state", name: "In progress", type: "started", color: "#fff" },
    priority: 2,
    assignee: { id: "user", name: "Alex" },
  };
}

function page(nodes: unknown[], cursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage: cursor !== null, endCursor: cursor } };
}

it("paginates children and both relation directions without turning hierarchy or duplicates into blockers", async () => {
  const requests: LinearTransportRequest[] = [];
  const responses = [
    { parent: neighbor("parent") },
    { children: page([neighbor("child-1")], "next-child") },
    { children: page([neighbor("child-2")]) },
    {
      page: page(
        [
          {
            id: "block",
            type: "blocks",
            issue: neighbor("current"),
            relatedIssue: neighbor("blocked"),
          },
        ],
        "next-relation",
      ),
    },
    {
      page: page([
        {
          id: "other",
          type: "duplicate",
          issue: neighbor("current"),
          relatedIssue: neighbor("duplicate"),
        },
      ]),
    },
    {
      page: page([
        {
          id: "blocked-by",
          type: "blocks",
          issue: neighbor("blocker"),
          relatedIssue: neighbor("current"),
        },
        {
          id: "related",
          type: "related",
          issue: neighbor("friend"),
          relatedIssue: neighbor("current"),
        },
      ]),
    },
  ];
  const client = createLinearApiClient(async (request) => {
    requests.push(request);
    return { status: 200, body: { data: { issue: responses.shift() } } };
  });
  const result = await client.issueRelations("key", "current");
  expect(result.parent?.external_id).toBe("parent");
  expect(result.parent).toMatchObject({ priority: 2, assignee: { id: "user", name: "Alex" } });
  expect(result.children.map((child) => child.external_id)).toEqual(["child-1", "child-2"]);
  expect(result.relations.map((relation) => [relation.type, relation.issue.external_id])).toEqual([
    ["blocks", "blocked"],
    ["blocked_by", "blocker"],
    ["related", "friend"],
  ]);
  expect(requests[2]?.variables["after"]).toBe("next-child");
  expect(requests[4]?.variables["after"]).toBe("next-relation");
  expect(requests[5]?.query).toContain("inverseRelations(");
  expect(requests[5]?.variables["after"]).toBeNull();
  expect(requests.every((request) => !request.query.includes("mutation"))).toBe(true);
});

it("refuses a partial GraphQL response instead of confirming an empty neighborhood", async () => {
  let reads = 0;
  const client = createLinearApiClient(async () => {
    reads += 1;
    return reads === 1
      ? { status: 200, body: { data: { issue: { parent: null } } } }
      : {
          status: 200,
          body: {
            data: { issue: { children: page([]) } },
            errors: [{ extensions: { code: "INTERNAL_SERVER_ERROR" } }],
          },
        };
  });
  await expect(client.issueRelations("key", "issue")).rejects.toMatchObject({
    code: "linear_request_failed",
  });
});

it("distinguishes a confirmed empty neighborhood from an inaccessible issue", async () => {
  const missing = createLinearApiClient(async () => ({
    status: 200,
    body: { data: { issue: null } },
  }));
  await expect(missing.issueRelations("key", "issue")).rejects.toMatchObject({
    code: "linear_remote_issue_not_found",
  });
  const responses = [
    { parent: null },
    { children: page([]) },
    { page: page([]) },
    { page: page([]) },
  ];
  const empty = createLinearApiClient(async () => ({
    status: 200,
    body: { data: { issue: responses.shift() } },
  }));
  await expect(empty.issueRelations("key", "issue")).resolves.toMatchObject({
    parent: null,
    children: [],
    relations: [],
  });
});

let fixture: TestDb | undefined;
afterEach(() => fixture?.cleanup());

it("links only neighbors on the same connection and never imports or changes issue state", async () => {
  const t = setupTestDb("linear-relations-");
  fixture = t;
  const client = stubLinearApiClient({
    viewer: async () => ({
      user_name: "User",
      workspace_id: "workspace",
      workspace_name: "Workspace",
    }),
    issueRelations: async () => ({
      parent: null,
      children: ["known", "foreign", "external"].map((id) => ({
        ...neighbor(id),
        external_id: id,
        issue_id: null,
      })),
      relations: [],
      checked_at: "2026-09-26T00:00:00.000Z",
    }),
  });
  const service = createLinearService({ db: t.db, dataDir: t.dir, client });
  await connectLinear(service, "key");
  insertIssueSource(t.db, {
    id: "source",
    project_id: "p1",
    source: "linear",
    connection_id: "c-otomat",
    external_team_id: "team",
    external_team_key: "TEST",
    external_team_name: "Test",
  });
  insertProject(t.db, { id: "other", name: "Other", root_path: "/other" });
  saveLinearConnection(t.db, {
    id: "foreign-connection",
    label: "Foreign",
    user_name: "Other",
    workspace_id: "foreign",
    workspace_name: "Foreign",
  });
  insertIssueSource(t.db, {
    id: "foreign-source",
    project_id: "other",
    source: "linear",
    connection_id: "foreign-connection",
    external_team_id: "team-other",
    external_team_key: "OTHER",
    external_team_name: "Other",
  });
  t.db
    .insert(schema.issues)
    .values([
      {
        id: "current",
        project_id: "p1",
        source: "linear",
        source_external_id: "current-external",
        title: "Current",
      },
      {
        id: "local-known",
        project_id: "p1",
        source: "linear",
        source_external_id: "known",
        title: "Known",
      },
      {
        id: "local-foreign",
        project_id: "other",
        source: "linear",
        source_external_id: "foreign",
        title: "Foreign",
      },
    ])
    .run();
  const before = t.client.sqlite.prepare("SELECT total_changes() AS count").get();
  const result = await service.issueRelations("current");
  expect(result.children.map((child) => child.issue_id)).toEqual(["local-known", null, null]);
  expect(t.client.sqlite.prepare("SELECT total_changes() AS count").get()).toEqual(before);
});
