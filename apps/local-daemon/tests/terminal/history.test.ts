import { appendTerminalFrame, createTerminalRecord, listTerminalRecords, schema } from "@otomat/db";
import { conversationSnapshotSchema, terminalOutputSchema } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { hasInteractiveWriter } from "#git/interactive-worktrees";
import { TerminalService } from "#terminal";
import { makeApiApp, post, request } from "#test-support/api";
import type { DaemonTestDb } from "#test-support/daemon-db";
import { closeTerminals, setupTerminals, type TerminalFixture } from "#test-support/terminals";

let fix: DaemonTestDb;
let terminals: TerminalService;
let repositories: TerminalFixture["repositories"];
let harness: TerminalFixture["harness"];
beforeEach(() => {
  ({ fix, terminals, repositories, harness } = setupTerminals());
});
afterEach(() => closeTerminals(terminals, fix));

it("lists project and issue terminals without runs and reads their output after restart", async () => {
  const project = await terminals.open({
    instance: terminals.instance,
    project_id: "p1",
    tool: null,
  });
  const issue = await terminals.open({
    instance: terminals.instance,
    issue_id: "i1",
    run_id: null,
    tool: null,
    context_hash: null,
  });
  const session = terminals.get(terminals.instance, project.id);
  session.write("printf 'saved-%s\\n' 'output'; exit 7\r");
  await expect.poll(() => session.info.state).toBe("exited");
  expect(session.output(0).data).toContain("saved-output");
  await terminals.shutdown();
  const oldInstance = terminals.instance;
  terminals = new TerminalService(fix.db, repositories, harness.supervisor);
  const app = makeApiApp(fix, { terminals });
  const snapshot = conversationSnapshotSchema.parse(
    await (await request(app, "/api/conversations")).json(),
  );
  expect(snapshot.entries).toHaveLength(2);
  expect(snapshot.entries.find((entry) => entry.id === `terminal:${project.id}`)).toMatchObject({
    project: { id: "p1" },
    issue: null,
    terminal: { state: "exited", exit_code: 7 },
    read: false,
  });
  expect(snapshot.entries.find((entry) => entry.id === `terminal:${issue.id}`)).toMatchObject({
    issue: { id: "i1" },
  });
  expect(snapshot.entries.every((entry) => !("run_id" in entry))).toBe(true);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(terminals.list()).toHaveLength(0);
  const path = `/api/terminals/${project.id}/output?instance=${terminals.instance}`;
  expect((await app.request(path, { headers: { Host: "127.0.0.1" } })).status).toBe(401);
  expect(() => terminals.output(oldInstance, project.id, 0)).toThrow(/host or daemon changed/);
  const response = await request(app, path);
  expect(response.status).toBe(200);
  const output = terminalOutputSchema.parse(await response.json());
  expect(output.data).toContain("saved-output");
  expect(output.session.state).toBe("exited");
  expect(
    (
      await post(app, `/api/terminals/${project.id}/input`, {
        instance: terminals.instance,
        data: "touch unwanted\r",
      })
    ).status,
  ).toBe(409);
  const entry = snapshot.entries[0];
  if (!entry) throw new Error("Missing terminal entry");
  expect(
    (
      await post(app, "/api/inbox/marks", {
        marks: [
          { entry_id: entry.id, read: true, archived: true, evidence_updated_at: entry.updated_at },
        ],
      })
    ).status,
  ).toBe(200);
  const marked = conversationSnapshotSchema.parse(
    await (await request(app, "/api/conversations")).json(),
  );
  expect(marked.entries.find((row) => row.id === entry.id)).toMatchObject({
    read: true,
    archived: true,
  });
});

it("marks an interrupted record ended, keeps only retained frames and replays by cursor", () => {
  const record = {
    id: "00000000-0000-4000-8000-000000000002",
    project_id: "p1",
    issue_id: null,
    worktree_id: null,
    path: fix.repo.root,
    branch: "main",
    tool: null,
    state: "running" as const,
    started_at: "2026-09-01T00:00:00Z",
    exit_code: null,
    signal: null,
  };
  createTerminalRecord(fix.db, record);
  appendTerminalFrame(fix.db, record.id, 1, "discarded", 1);
  appendTerminalFrame(fix.db, record.id, 2, "retained-é✓", 2);
  terminals = new TerminalService(fix.db, repositories, harness.supervisor);
  expect(terminals.output(terminals.instance, record.id, 0)).toMatchObject({
    data: "retained-é✓",
    cursor: 2,
    truncated: true,
    session: { state: "exited", exit_code: null },
  });
  expect(terminals.output(terminals.instance, record.id, 2)).toMatchObject({
    data: "",
    truncated: false,
  });
  expect(fix.db.select().from(schema.terminalFrames).all()).toHaveLength(1);
  const updated = listTerminalRecords(fix.db)[0]?.updated_at;
  terminals = new TerminalService(fix.db, repositories, harness.supervisor);
  expect(listTerminalRecords(fix.db)[0]?.updated_at).toBe(updated);
});

it("stops the writer and reports a failed recording instead of acknowledging success", async () => {
  const opened = await terminals.open({
    instance: terminals.instance,
    project_id: "p1",
    tool: null,
  });
  const session = terminals.get(terminals.instance, opened.id);
  session.write("printf 'ready-%s\\n' 'marker'\r");
  await expect.poll(() => session.output(0).data).toContain("ready-marker");
  fix.client.sqlite.exec(
    "CREATE TRIGGER refuse_terminal_output BEFORE INSERT ON terminal_frames BEGIN SELECT RAISE(FAIL, 'disk unavailable'); END",
  );
  session.write("echo cannot-record\r");
  await expect.poll(() => session.info.state).toBe("exited");
  expect(() => session.output(0)).toThrow(/recording failed/);
  expect(() => session.write("more")).toThrow(/recording failed/);
  await expect(session.close()).rejects.toThrow(/recording failed/);
  expect(hasInteractiveWriter(opened.path)).toBe(false);
  await expect(terminals.shutdown()).rejects.toThrow(/could not stop/);
  fix.client.sqlite.exec("DROP TRIGGER refuse_terminal_output");
  terminals = new TerminalService(fix.db, repositories, harness.supervisor);
  expect(terminals.output(terminals.instance, opened.id, 0).data).toContain("ready-marker");
});
