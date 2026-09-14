import { insertIssue, schema } from "@otomat/db";
import { issueSearchResponseSchema, issueSummarySchema, runSummarySchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { makeApiApp, request } from "#test-support/api";
import { setupTestDb, type TestDb } from "#test-support/db";
import { seedRun } from "#test-support/seed";

let fixture: TestDb;
beforeEach(() => {
  fixture = setupTestDb("otomat-catalog-");
});
afterEach(() => fixture.cleanup());

it("lists metadata without descriptions or plans and keeps the complete detail", async () => {
  insertIssue(fixture.db, {
    id: "documented",
    project_id: "p1",
    title: "Documented",
    body: "Long description",
  });
  seedRun(fixture.db, {
    runId: "r1",
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  const app = makeApiApp(fixture);
  const catalog = await (await request(app, "/api/issues/catalog?projectId=p1")).json();
  expect(issueSummarySchema.array().parse(catalog)).toHaveLength(2);
  expect(JSON.stringify(catalog)).not.toContain('"body"');
  const runs = await (await request(app, "/api/runs/catalog?projectId=p1")).json();
  expect(runSummarySchema.array().parse(runs)[0]).toMatchObject({ id: "r1", status: "completed" });
  expect(JSON.stringify(runs)).not.toContain("plan_json");
  expect(await (await request(app, "/api/issues/documented")).json()).toMatchObject({
    body: "Long description",
  });
});

it("searches complete descriptions, bounds results and isolates the project", async () => {
  fixture.db
    .insert(schema.projects)
    .values({ id: "p2", name: "Other", root_path: `${fixture.dir}/other` })
    .run();
  insertIssue(fixture.db, { id: "private", project_id: "p2", title: "Needle" });
  for (let index = 0; index < 25; index++)
    insertIssue(fixture.db, {
      id: `body-${index}`,
      project_id: "p1",
      title: `Issue ${index}`,
      body: "Contains Néédle only in the description",
    });
  insertIssue(fixture.db, { id: "title", project_id: "p1", title: "Néédle" });
  const app = makeApiApp(fixture);
  const result = issueSearchResponseSchema.parse(
    await (
      await request(app, `/api/issues/search?projectId=p1&query=${encodeURIComponent("NÉÉDLE")}`)
    ).json(),
  );
  expect(result.total).toBe(26);
  expect(result.issues).toHaveLength(20);
  expect(result.issues[0].id).toBe("title");
  expect(result.issues.some((issue) => issue.id === "private")).toBe(false);
  expect(result.issues.every((issue) => !("body" in issue))).toBe(true);
  expect((await request(app, "/api/issues/search?query=x")).status).toBe(400);
});
