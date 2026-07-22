import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getIssue,
  insertLinearWrite,
  listLinearWritesForIssue,
  schema,
  updateLinearWrite,
  upsertMirroredIssue,
} from "@otomat/db";
import type { SaveLinearDraftRequest } from "@otomat/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  createLinearApiClient,
  createLinearService,
  LinearWriteConflictError,
  type LinearIssueDetail,
  type LinearIssueEditor,
  type LinearService,
  type LinearTransport,
} from "#linear";

import { setupTestDb, type TestDb } from "../support/db.js";
import { stubLinearApiClient } from "../support/linear.js";

const API_KEY = "lin_api_secret_do_not_leak";
const BASE = "2026-07-20T10:00:00.000Z";
const REMOTE_CHANGED = "2026-07-21T09:00:00.000Z";
const COMMENT_UUID = "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const PR_URL = "https://github.com/acme/repo/pull/42";

let t: TestDb;
let counter: number;

beforeEach(() => {
  t = setupTestDb("otomat-linear-writeback-");
  counter = 0;
});

afterEach(() => {
  t.cleanup();
});

function seedLinearIssue(updatedAt = BASE): void {
  upsertMirroredIssue(t.db, {
    id: "li",
    project_id: "p1",
    source: "linear",
    source_external_id: "L-1",
    source_identifier: "OTO-99",
    source_url: "https://linear.app/otomat/issue/OTO-99",
    title: "Mirror",
    body: "Body",
    status: "ready",
    synced_at: BASE,
    source_updated_at: updatedAt,
    source_assignee_name: null,
    source_priority: 2,
    source_labels: null,
    source_state_name: null,
    source_state_color: null,
  });
}

function seedRun(): void {
  t.db
    .insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "li",
      status: "running",
      branch: "otomat/run/r1",
      plan_json: { version: 1, steps: [] },
    })
    .run();
}

function detail(overrides: Partial<LinearIssueDetail> = {}): LinearIssueDetail {
  return {
    external_id: "L-1",
    identifier: "OTO-99",
    title: "Mirror",
    description: "Body",
    url: "https://linear.app/otomat/issue/OTO-99",
    updated_at: BASE,
    priority: 2,
    assignee: { id: "u1", name: "Alim" },
    labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
    state: { id: "s-todo", name: "Todo", type: "unstarted", color: "#888" },
    ...overrides,
  };
}

function draftRequest(overrides: Partial<SaveLinearDraftRequest> = {}): SaveLinearDraftRequest {
  return {
    base_updated_at: BASE,
    title: "Mirror",
    description: "Body",
    priority: 2,
    assignee_id: "u1",
    label_ids: ["lab1"],
    ...overrides,
  };
}

async function connectedService(
  overrides: Parameters<typeof stubLinearApiClient>[0] = {},
): Promise<LinearService> {
  const svc = createLinearService({
    db: t.db,
    dataDir: t.dir,
    client: stubLinearApiClient({
      viewer: async () => ({ user_name: "Alim", workspace_id: "w1", workspace_name: "Otomat" }),
      ...overrides,
    }),
    idFactory: () => `id-${(counter += 1)}`,
    now: () => new Date("2026-07-21T12:00:00.000Z"),
  });
  await svc.connect(API_KEY);
  return svc;
}

function readLedger(runId: string): string {
  const file = join(t.dir, "runs", runId, "events.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

it("persists a draft that survives a daemon restart and only leaves on discard", async () => {
  seedLinearIssue();
  const first = await connectedService();
  first.writeback.saveDraft("li", draftRequest({ title: "Edited offline" }));
  expect(first.writeback.writebackState("li").draft?.title).toBe("Edited offline");

  const afterRestart = await connectedService();
  expect(afterRestart.writeback.writebackState("li").draft?.title).toBe("Edited offline");

  afterRestart.writeback.discardDraft("li");
  expect(afterRestart.writeback.writebackState("li").draft).toBeNull();
});

it("blocks a fields publish when the remote issue changed, without writing", async () => {
  seedLinearIssue(BASE);
  const updateIssue = vi.fn();
  const svc = await connectedService({
    issueSnapshot: async () => detail({ updated_at: REMOTE_CHANGED, title: "Changed remotely" }),
    updateIssue,
  });
  svc.writeback.saveDraft("li", draftRequest({ base_updated_at: BASE, title: "My local edit" }));

  const error = await svc.writeback
    .publishFields("li", { overwrite: false })
    .catch((caught) => caught);
  expect(error).toBeInstanceOf(LinearWriteConflictError);
  expect((error as LinearWriteConflictError).remote.title).toBe("Changed remotely");
  expect(updateIssue).not.toHaveBeenCalled();

  const state = svc.writeback.writebackState("li");
  expect(state.draft?.title).toBe("My local edit");
  expect(state.writes[0]).toMatchObject({
    kind: "fields",
    status: "failed",
    error_code: "linear_write_conflict",
  });
});

it("overwrites a conflicting remote issue only on explicit confirmation, then clears the draft", async () => {
  seedLinearIssue(BASE);
  const updateIssue = vi.fn(async (_key, _id, input) =>
    detail({ updated_at: "2026-07-21T12:00:00.000Z", title: input.title ?? "Mirror" }),
  );
  const svc = await connectedService({
    issueSnapshot: async () => detail({ updated_at: REMOTE_CHANGED }),
    updateIssue,
  });
  svc.writeback.saveDraft("li", draftRequest({ base_updated_at: BASE, title: "My local edit" }));

  const state = await svc.writeback.publishFields("li", { overwrite: true });
  expect(updateIssue).toHaveBeenCalledOnce();
  expect(updateIssue.mock.calls[0][2]).toMatchObject({ title: "My local edit" });
  expect(state.draft).toBeNull();
  expect(state.writes[0].status).toBe("sent");
  expect(getIssue(t.db, "li")?.title).toBe("My local edit");
});

it("treats a fields publish whose values already match the remote as a reconciled no-op", async () => {
  seedLinearIssue(BASE);
  const updateIssue = vi.fn();
  const svc = await connectedService({
    // Remote already carries the drafted values (e.g. a previous attempt landed but the response was lost).
    issueSnapshot: async () => detail({ updated_at: REMOTE_CHANGED }),
    updateIssue,
  });
  svc.writeback.saveDraft("li", draftRequest({ base_updated_at: BASE }));

  const state = await svc.writeback.publishFields("li", { overwrite: false });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes[0].status).toBe("sent");
  expect(state.draft).toBeNull();
});

it("publishes a status idempotently and emits a linear-sourced ledger event for the run", async () => {
  seedLinearIssue();
  seedRun();
  const updateIssue = vi.fn(async () =>
    detail({ state: { id: "s-done", name: "Done", type: "completed", color: "#0a0" } }),
  );
  const svc = await connectedService({
    issueSnapshot: async () => detail(),
    updateIssue,
  });

  await svc.writeback.publishStatus("li", { state_id: "s-done", run_id: "r1" });
  expect(updateIssue).toHaveBeenCalledOnce();
  const ledger = readLedger("r1");
  expect(ledger).toContain("linear.status_published");
  expect(ledger).toContain('"source":"linear"');

  updateIssue.mockClear();
  const state = await svc.writeback.publishStatus("li", { state_id: "s-done", run_id: "r1" });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes.filter((write) => write.kind === "status")).toHaveLength(1);
});

it("skips the status mutation when the remote issue is already in the target state", async () => {
  seedLinearIssue();
  const updateIssue = vi.fn();
  const svc = await connectedService({
    issueSnapshot: async () =>
      detail({ state: { id: "s-done", name: "Done", type: "completed", color: "#0a0" } }),
    updateIssue,
  });

  const state = await svc.writeback.publishStatus("li", { state_id: "s-done" });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes[0].status).toBe("sent");
});

it("dedupes a PR-link attachment by URL", async () => {
  seedLinearIssue();
  const linkAttachment = vi.fn(async () => "att-1");
  const svc = await connectedService({ linkAttachment });

  await svc.writeback.publishPrLink("li", { url: PR_URL, title: "PR #42" });
  expect(linkAttachment).toHaveBeenCalledOnce();

  linkAttachment.mockClear();
  await svc.writeback.publishPrLink("li", { url: PR_URL, title: "PR #42" });
  expect(linkAttachment).not.toHaveBeenCalled();
});

it("reconciles an interrupted comment against Linear before resending, never duplicating it", async () => {
  seedLinearIssue();
  insertLinearWrite(t.db, {
    id: "w-comment",
    issue_id: "li",
    run_id: null,
    kind: "comment",
    idempotency_key: COMMENT_UUID,
    payload_json: { body: "Ran the agent", parent_id: null },
    detail: "Ran the agent",
  });
  updateLinearWrite(t.db, "w-comment", { status: "failed", error_code: "linear_unavailable" });

  const createComment = vi.fn(async () => COMMENT_UUID);
  const svc = await connectedService({
    listComments: async () => [
      {
        id: COMMENT_UUID,
        body: "Ran the agent",
        author_name: "Alim",
        created_at: "2026-07-20T12:00:00.000Z",
        parent_id: null,
      },
    ],
    createComment,
  });

  const state = await svc.writeback.retryWrite("w-comment");
  expect(createComment).not.toHaveBeenCalled();
  expect(state.writes[0]).toMatchObject({ id: "w-comment", status: "sent" });
});

it("retries a failed threaded reply with its parent intact", async () => {
  seedLinearIssue();
  insertLinearWrite(t.db, {
    id: "w-reply",
    issue_id: "li",
    run_id: null,
    kind: "comment",
    idempotency_key: COMMENT_UUID,
    payload_json: { body: "Sounds good", parent_id: "c-root" },
    detail: "Sounds good",
  });
  updateLinearWrite(t.db, "w-reply", { status: "failed", error_code: "linear_unavailable" });

  const createComment = vi.fn(async () => COMMENT_UUID);
  const svc = await connectedService({ listComments: async () => [], createComment });

  const state = await svc.writeback.retryWrite("w-reply");
  expect(createComment).toHaveBeenCalledWith(
    expect.anything(),
    { id: COMMENT_UUID, issueId: "L-1", body: "Sounds good", parentId: "c-root" },
    expect.anything(),
  );
  expect(state.writes.find((write) => write.id === "w-reply")?.status).toBe("sent");
});

it("lists remote comments sorted by creation time", async () => {
  seedLinearIssue();
  const svc = await connectedService({
    listComments: async () => [
      {
        id: "c2",
        body: "Second",
        author_name: "Fawsy",
        created_at: "2026-07-21T11:00:00.000Z",
        parent_id: "c1",
      },
      {
        id: "c1",
        body: "First",
        author_name: null,
        created_at: "2026-07-21T10:00:00.000Z",
        parent_id: null,
      },
    ],
  });

  const comments = await svc.writeback.comments("li");
  expect(comments.map((comment) => comment.id)).toEqual(["c1", "c2"]);
  expect(comments[1]).toMatchObject({ author_name: "Fawsy", parent_id: "c1" });
});

it("publishes a threaded reply with its parent id", async () => {
  seedLinearIssue();
  const createComment = vi.fn(async () => COMMENT_UUID);
  const svc = await connectedService({
    listComments: async () => [],
    createComment,
  });

  await svc.writeback.publishComment("li", {
    client_id: COMMENT_UUID,
    body: "Replying in thread",
    run_id: null,
    parent_id: "c-root",
  });

  expect(createComment).toHaveBeenCalledWith(
    expect.anything(),
    { id: COMMENT_UUID, issueId: "L-1", body: "Replying in thread", parentId: "c-root" },
    expect.anything(),
  );
});

it("recovers a write interrupted by a crash into a retryable failure", async () => {
  seedLinearIssue();
  insertLinearWrite(t.db, {
    id: "w-int",
    issue_id: "li",
    run_id: null,
    kind: "status",
    idempotency_key: "s-x",
    payload_json: { state_id: "s-x" },
    detail: null,
  });
  updateLinearWrite(t.db, "w-int", { status: "sending" });

  const svc = await connectedService();
  const state = svc.writeback.writebackState("li");
  expect(state.writes[0]).toMatchObject({
    status: "failed",
    error_code: "linear_write_interrupted",
  });
});

it("persists an offline publish attempt as a retryable failure", async () => {
  seedLinearIssue();
  const svc = await connectedService();
  svc.disconnect();

  await expect(svc.writeback.publishStatus("li", { state_id: "s-done" })).rejects.toThrow();
  const state = svc.writeback.writebackState("li");
  expect(state.writes[0]).toMatchObject({ kind: "status", status: "failed" });
  expect(state.writes[0].error_code).toBe("linear_not_connected");
});

const rateLimitedTransport: LinearTransport = async ({ query }) => {
  if (query.includes("OtomatViewer")) {
    return {
      status: 200,
      body: { data: { viewer: { name: "Alim" }, organization: { id: "w1", name: "Otomat" } } },
    };
  }
  return { status: 400, body: { errors: [{ extensions: { code: "RATELIMITED" } }] } };
};

it("classifies a rate-limited GraphQL body even under HTTP 400 and persists it", async () => {
  seedLinearIssue();
  const svc = createLinearService({
    db: t.db,
    dataDir: t.dir,
    client: createLinearApiClient(rateLimitedTransport),
    idFactory: () => `id-${(counter += 1)}`,
    now: () => new Date("2026-07-21T12:00:00.000Z"),
  });
  await svc.connect(API_KEY);

  await expect(svc.writeback.publishStatus("li", { state_id: "s-done" })).rejects.toThrow();
  const state = svc.writeback.writebackState("li");
  expect(state.writes[0].error_code).toBe("linear_rate_limited");
});

it("maps the editor state from real remote values and team metadata", async () => {
  seedLinearIssue();
  const editor: LinearIssueEditor = {
    issue: detail(),
    team: {
      team_id: "t1",
      states: [{ id: "s-todo", name: "Todo", type: "unstarted", color: "#888" }],
      members: [{ id: "u1", name: "Alim" }],
      labels: [{ id: "lab1", name: "Bug", color: "#f00" }],
    },
  };
  const svc = await connectedService({ issueEditor: async () => editor });

  const state = await svc.writeback.editorState("li");
  expect(state.snapshot.assignee_id).toBe("u1");
  expect(state.snapshot.label_ids).toEqual(["lab1"]);
  expect(state.team_metadata.states[0].name).toBe("Todo");
});

it("never persists the API key in rows or the ledger", async () => {
  seedLinearIssue();
  seedRun();
  const svc = await connectedService({
    listComments: async () => [],
    createComment: async () => "cmt-1",
  });

  await svc.writeback.publishComment("li", {
    client_id: COMMENT_UUID,
    body: "Landed the fix",
    run_id: "r1",
  });

  const dump = JSON.stringify([
    listLinearWritesForIssue(t.db, "li"),
    t.db.select().from(schema.linearIssueDrafts).all(),
    t.db.select().from(schema.runtimeEvents).all(),
    readLedger("r1"),
  ]);
  expect(dump).not.toContain(API_KEY);
});
