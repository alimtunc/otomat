import { renameSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createRepositoryResolver } from "#git";
import { TerminalService } from "#terminal/service";
import { makeApiApp, post } from "#test-support/api";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { setupTestRepo } from "#test-support/git";
import { makeSupervisor } from "#test-support/supervisor";

let fix: DaemonTestDb;
let terminals: TerminalService;
let app: ReturnType<typeof makeApiApp>;
beforeEach(() => {
  fix = setupDaemonDb();
  const repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  const { supervisor } = makeSupervisor(fix, "complete", { repositories });
  terminals = new TerminalService(fix.db, repositories, supervisor);
  app = makeApiApp(fix, { terminals, supervisor, repositories });
});
afterEach(async () => {
  await terminals.shutdown();
  fix.cleanup();
});

it("opens and reattaches the project checkout without creating issues, runs or worktrees", async () => {
  const input = { instance: terminals.instance, project_id: "p1", tool: null };
  const [first, second] = await Promise.all([terminals.open(input), terminals.open(input)]);
  expect(second.id).toBe(first.id);
  expect(first).toMatchObject({
    project_id: "p1",
    issue_id: null,
    worktree_id: null,
    path: fix.repo.root,
  });
  const session = terminals.get(terminals.instance, first.id);
  session.write("pwd\r");
  await expect.poll(() => session.output(0).data).toContain(fix.repo.root);
  expect(fix.db.select().from(schema.issues).all()).toHaveLength(1);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(0);
  const issue = await terminals.open({
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  });
  expect(issue.path).not.toBe(first.path);
  expect(terminals.list()).toHaveLength(2);
  expect(terminals.hasRepositorySessions(fix.repositoryId)).toBe(true);
  const deletion = await app.request(`/api/repositories/${fix.repositoryId}`, {
    method: "DELETE",
    headers: { Host: "127.0.0.1", Authorization: "Bearer test-daemon-token" },
  });
  expect(deletion.status).toBe(409);
});

it("keeps project launches behind auth and rejects injected paths, tools and issue data", async () => {
  const input = { instance: terminals.instance, project_id: "p1", tool: null };
  const denied = await app.request("/api/terminals", {
    method: "POST",
    headers: { Host: "127.0.0.1", "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  expect(denied.status).toBe(401);
  for (const extra of [
    { cwd: "/tmp" },
    { tool: "bash" },
    { issue_id: "i1", run_id: null, context_hash: null },
    { context_hash: "unexpected" },
  ]) {
    expect((await post(app, "/api/terminals", { ...input, ...extra })).status).toBe(400);
  }
  expect((await post(app, "/api/terminals", { ...input, project_id: "missing" })).status).toBe(409);
  expect(terminals.list()).toHaveLength(0);
});

it("refuses a registered checkout replaced with a symlink to another repository", async () => {
  const other = setupTestRepo();
  const saved = `${fix.repo.root}-saved`;
  renameSync(fix.repo.root, saved);
  symlinkSync(other.root, fix.repo.root);
  try {
    await expect(
      terminals.open({ instance: terminals.instance, project_id: "p1", tool: null }),
    ).rejects.toThrow(/checkout changed/);
    expect(terminals.list()).toHaveLength(0);
  } finally {
    unlinkSync(fix.repo.root);
    renameSync(saved, fix.repo.root);
    other.cleanup();
  }
});
