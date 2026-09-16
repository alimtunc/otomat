import type { RepositoryTreeResponse, WorktreeFileContent } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, put, request } from "../support/api.js";
import { setupCheckoutApi, type CheckoutApiFixture } from "../support/checkout-api.js";

let fix: CheckoutApiFixture;

beforeEach(() => {
  fix = setupCheckoutApi();
});

afterEach(() => fix.cleanup());

it("browses the project checkout on its current branch without changing its staging area", async () => {
  fix.repo.git("switch", "-c", "feat/current-project");
  fix.repo.write("project-only.json", '{"project":true}\n');
  const index = fix.repo.git("diff", "--cached");
  const listing = await json<RepositoryTreeResponse>(
    await request(fix.app, "/api/repositories/repo-1/tree"),
  );
  expect(listing.branch).toBe("feat/current-project");
  expect(listing.entries.map((entry) => entry.path)).toContain("project-only.json");
  const content = await request(
    fix.app,
    "/api/repositories/repo-1/tree/content?path=project-only.json",
  );
  expect(await content.json()).toMatchObject({ kind: "text", text: '{"project":true}\n' });
  expect(fix.repo.git("diff", "--cached")).toBe(index);
  const opened = await json<WorktreeFileContent>(
    await request(fix.app, "/api/repositories/repo-1/tree/content?path=project-only.json"),
  );
  const saved = await put(fix.app, "/api/repositories/repo-1/tree/content", {
    path: "project-only.json",
    revision: opened.revision,
    text: "edited",
  });
  expect(saved.status).toBe(200);
  expect(fix.repo.git("diff", "--cached")).toBe(index);
  const run = await json<WorktreeFileContent>(
    await request(fix.app, "/api/runs/run-files/files/content?path=src/app.ts"),
  );
  expect(run).toMatchObject({ kind: "text", text: "export const a = 1;\n" });
  const stale = await put(fix.app, "/api/repositories/repo-1/tree/content", {
    path: "project-only.json",
    revision: opened.revision,
    text: "stale",
  });
  expect(stale.status).toBe(409);
});
