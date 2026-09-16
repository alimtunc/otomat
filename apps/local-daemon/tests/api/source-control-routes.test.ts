import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SourceControlResponse } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { json, post, request } from "../support/api.js";
import {
  FILES_RUN_ID as RUN_ID,
  setupCheckoutApi,
  type CheckoutApiFixture,
} from "../support/checkout-api.js";

let fix: CheckoutApiFixture;

beforeEach(() => {
  fix = setupCheckoutApi();
});

afterEach(() => fix.cleanup());

it("stages only the selected worktree, returns stale refusals, and rejects an archived target", async () => {
  const path = `/api/source-control/run/${RUN_ID}`;
  writeFileSync(join(fix.worktree, "src/app.ts"), "worktree\n");
  const before = await json<SourceControlResponse>(await request(fix.app, path));
  expect(before.unstaged.map((entry) => entry.path)).toEqual(["src/app.ts"]);
  const staged = await post(fix.app, path, {
    action: "stage",
    path: "src/app.ts",
    revision: before.revision,
  });
  expect(staged.status).toBe(200);
  expect(fix.repo.git("diff", "--cached")).toBe("");
  const after = await json<SourceControlResponse>(await request(fix.app, path));
  expect(after.staged.map((entry) => entry.path)).toEqual(["src/app.ts"]);
  const stale = await post(fix.app, path, {
    action: "unstage",
    path: "src/app.ts",
    revision: before.revision,
  });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: "checkout_stale" });
  fix.service.archive(RUN_ID);
  expect((await request(fix.app, path)).status).toBe(409);
});

it("commits the selected worktree's staged files and records its new tip", async () => {
  const path = `/api/source-control/run/${RUN_ID}`;
  const original = fix.repo.git("rev-parse", "HEAD");
  writeFileSync(join(fix.worktree, "src/app.ts"), "staged\n");
  const before = await json<SourceControlResponse>(await request(fix.app, path));
  expect(
    (await post(fix.app, path, { action: "stage", all: true, revision: before.revision })).status,
  ).toBe(200);
  writeFileSync(join(fix.worktree, "src/app.ts"), "unstaged\n");
  const staged = await json<SourceControlResponse>(await request(fix.app, path));
  const committed = await post(fix.app, `${path}/commit`, {
    revision: staged.revision,
    message: "feat: edit the worktree",
  });
  expect(committed.status).toBe(200);
  expect(await committed.json()).toMatchObject({ sha: fix.service.get(RUN_ID)?.headSha });
  expect(fix.repo.git("rev-parse", "HEAD")).toBe(original);
  const after = await json<SourceControlResponse>(await request(fix.app, path));
  expect(after.staged).toEqual([]);
  expect(after.unstaged[0]?.patch).toContain("-staged\n+unstaged");
});
