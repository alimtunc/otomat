import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import { schema, updateIssueStatus } from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createRepositoryResolver } from "#git";
import { hasInteractiveWriter } from "#git/interactive-worktrees";
import { findWorktreeById } from "#git/worktrees-store";
import { terminalContext } from "#terminal/context";
import { TerminalService } from "#terminal/service";
import { makeApiApp, post } from "#test-support/api";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { makeSupervisor } from "#test-support/supervisor";

let fix: DaemonTestDb;
let terminals: TerminalService;
let repositories: ReturnType<typeof createRepositoryResolver>;
let harness: ReturnType<typeof makeSupervisor>;
beforeEach(() => {
  fix = setupDaemonDb();
  repositories = createRepositoryResolver({
    db: fix.db,
    worktreesRoot: join(fix.dataDir, "worktrees"),
  });
  harness = makeSupervisor(fix, "complete", { repositories });
  terminals = new TerminalService(fix.db, repositories, harness.supervisor);
});
afterEach(async () => {
  await terminals.shutdown();
  fix.cleanup();
  vi.unstubAllEnvs();
});

it("owns a real PTY independently of runs, reattaches, resizes and retains its exit", async () => {
  const input = {
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  };
  const opened = await terminals.open(input);
  const session = terminals.get(terminals.instance, opened.id);
  session.write("stty -echo\r");
  session.resize(92, 31);
  session.write("pwd; stty size; printf '\\033[32mPTY-é✓\\033[0m\\n'\r");
  await expect.poll(() => session.output(0).data).toContain("PTY-é✓");
  await expect.poll(() => session.output(0).data).toContain("31 92");
  expect(session.output(0).data).toContain(opened.path);
  expect((await terminals.open(input)).id).toBe(opened.id);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(harness.spawn.calls).toBe(0);
  if (opened.worktree_id === null) throw new Error("Issue worktree missing");
  const row = findWorktreeById(fix.db, opened.worktree_id);
  expect(row?.owner_token).toBeTruthy();
  expect(hasInteractiveWriter(realpathSync(opened.path))).toBe(true);
  await expect(
    repositories.forRepository(fix.repositoryId)?.service.cleanup(row?.owner_token ?? ""),
  ).rejects.toThrow(/End the terminal/);
  expect(() => terminals.get(randomUUID(), opened.id)).toThrow(/host or daemon changed/);
  session.write("exit 7\r");
  await expect.poll(() => session.info.state).toBe("exited");
  expect(session.info.exit_code).toBe(7);
  expect(() => session.write("anything")).toThrow(/ended/);
});

it("keeps all terminal API operations behind authentication and rejects arbitrary launch data", async () => {
  const app = makeApiApp(fix, { terminals, supervisor: harness.supervisor, repositories });
  const input = {
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  };
  for (const headers of [
    { Host: "127.0.0.1" },
    {
      Host: "127.0.0.1",
      Origin: "https://evil.example",
      Authorization: "Bearer test-daemon-token",
    },
  ]) {
    const response = await app.request("/api/terminals", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    expect([401, 403]).toContain(response.status);
  }
  expect(terminals.list()).toHaveLength(0);
  expect(
    (await post(app, "/api/terminals", { ...input, cwd: "/tmp", command: "arbitrary" })).status,
  ).toBe(400);
  expect((await post(app, "/api/terminals", { ...input, tool: "bash" })).status).toBe(400);
  expect((await post(app, "/api/terminals", { ...input, instance: randomUUID() })).status).toBe(
    409,
  );
  const result = await post(app, "/api/terminals", input);
  expect(result.status).toBe(200);
  const deletion = await app.request(`/api/repositories/${fix.repositoryId}`, {
    method: "DELETE",
    headers: { Host: "127.0.0.1", Authorization: "Bearer test-daemon-token" },
  });
  expect(deletion.status).toBe(409);
  expect(await deletion.json()).toMatchObject({ error: "repository_has_active_terminals" });
  const session = terminals.list()[0];
  if (!session) throw new Error("terminal missing");
  expect(
    (await app.request(`/api/terminals/${session.id}/output`, { headers: { Host: "127.0.0.1" } }))
      .status,
  ).toBe(401);
  expect(
    (await post(app, `/api/terminals/${session.id}/close`, { instance: terminals.instance }))
      .status,
  ).toBe(200);
  expect(session.state).toBe("exited");
});

it("refuses unavailable hosts and requires re-inspection when context changes", async () => {
  expect((await post(makeApiApp(fix), "/api/terminals", {})).status).toBe(503);
  const preview = terminalContext(fix.db, "i1", "codex");
  expect(preview.argv).toHaveLength(1);
  expect(preview.argv[0]).toMatch(/^Issue: /);
  expect(() => terminalContext(fix.db, "i1", "bash")).toThrow();
  await expect(
    terminals.open({
      instance: terminals.instance,
      issue_id: "i1",
      run_id: null,
      tool: "codex",
      context_hash: "stale",
    }),
  ).rejects.toThrow(/Inspect it again/);
  expect(terminals.list()).toHaveLength(0);
});

it("stops a foreground command on daemon shutdown and refuses the stale instance", async () => {
  const opened = await terminals.open({
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  });
  const session = terminals.get(terminals.instance, opened.id);
  session.write("stty -echo\r");
  session.write("sh -c 'echo CHILD:$$; exec sleep 60'\r");
  await expect.poll(() => session.output(0).data).toMatch(/CHILD:\d+/);
  const match = /CHILD:(\d+)/.exec(session.output(0).data);
  const pid = Number(match?.[1]);
  expect(pid).toBeGreaterThan(0);
  await terminals.shutdown();
  expect(session.info.state).toBe("exited");
  await expect
    .poll(() => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
        throw error;
      }
    })
    .toBe(false);
  expect(() => terminals.get(terminals.instance, opened.id)).toThrow(/host or daemon changed/);
});

it("keeps the previous issue session reachable until it ends across a new cycle", async () => {
  const request = {
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  };
  const first = await terminals.open(request);
  updateIssueStatus(fix.db, "i1", "done");
  updateIssueStatus(fix.db, "i1", "ready");
  await expect(terminals.open(request)).rejects.toThrow(/previous terminal session/);
  expect(terminals.list()).toHaveLength(1);
  await terminals.get(terminals.instance, first.id).close();
  const next = await terminals.open(request);
  expect(next.worktree_id).not.toBe(first.worktree_id);
  expect(next.id).not.toBe(first.id);
});

it.each(["claude", "codex"] as const)(
  "starts %s with zero arguments when issue context is omitted",
  async (tool) => {
    const bin = join(fix.dataDir, "bin");
    mkdirSync(bin);
    writeFileSync(
      join(bin, tool),
      "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));\n",
      { mode: 0o755 },
    );
    vi.stubEnv("PATH", `${bin}${delimiter}${process.env.PATH}`);
    const opened = await terminals.open({
      instance: terminals.instance,
      issue_id: "i1",
      run_id: null,
      tool,
      context_hash: null,
    });
    const session = terminals.get(terminals.instance, opened.id);
    await expect.poll(() => session.info.state).toBe("exited");
    expect(JSON.parse(session.output(0).data)).toEqual({ args: [], cwd: opened.path });
    expect(session.info.exit_code).toBe(0);
    const preview = terminalContext(fix.db, "i1", tool);
    const withContext = await terminals.open({
      instance: terminals.instance,
      issue_id: "i1",
      run_id: null,
      tool,
      context_hash: preview.context_hash,
    });
    const contextual = terminals.get(terminals.instance, withContext.id);
    await expect.poll(() => contextual.info.state).toBe("exited");
    expect(JSON.parse(contextual.output(0).data)).toEqual({ args: preview.argv, cwd: opened.path });
    const project = await terminals.open({ instance: terminals.instance, project_id: "p1", tool });
    const projectSession = terminals.get(terminals.instance, project.id);
    await expect.poll(() => projectSession.info.state).toBe("exited");
    expect(JSON.parse(projectSession.output(0).data)).toEqual({ args: [], cwd: fix.repo.root });
    expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  },
);
