import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getLinearWrite,
  getLinearWriteByIdentity,
  insertLinearWrite,
  listLinearWritesForIssue,
  updateLinearWrite,
} from "#db/repositories/linear-writes";

import { createTempDb, seedReviewRun, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-linear-writes-");
  seedReviewRun(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("persists an attempt before any provider call and transitions it in place", () => {
  const { db } = t.client;
  insertLinearWrite(db, {
    id: "write-1",
    issue_id: "i1",
    run_id: "r1",
    kind: "status",
    idempotency_key: "state-done",
    payload_json: { state_id: "state-done" },
    detail: "Set status to Done",
  });

  expect(getLinearWrite(db, "write-1")).toMatchObject({
    id: "write-1",
    issue_id: "i1",
    run_id: "r1",
    kind: "status",
    status: "pending",
    idempotency_key: "state-done",
    remote_id: null,
    error_code: null,
  });

  updateLinearWrite(db, "write-1", { status: "sending" });
  updateLinearWrite(db, "write-1", { status: "sent", remote_id: "issue-1" });
  expect(getLinearWrite(db, "write-1")).toMatchObject({ status: "sent", remote_id: "issue-1" });
});

it("finds an attempt by its idempotency identity for reconciliation", () => {
  const { db } = t.client;
  insertLinearWrite(db, {
    id: "write-1",
    issue_id: "i1",
    run_id: null,
    kind: "comment",
    idempotency_key: "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    payload_json: { body: "done" },
    detail: "done",
  });

  expect(
    getLinearWriteByIdentity(db, "i1", "comment", "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f")?.id,
  ).toBe("write-1");
  expect(getLinearWriteByIdentity(db, "i1", "comment", "other")).toBeUndefined();
});

it("rejects a duplicate attempt for the same issue, kind and key", () => {
  const { db } = t.client;
  const row = {
    id: "write-1",
    issue_id: "i1",
    run_id: null,
    kind: "pr_link" as const,
    idempotency_key: "https://github.com/acme/repo/pull/42",
    payload_json: { url: "https://github.com/acme/repo/pull/42" },
    detail: null,
  };
  insertLinearWrite(db, row);
  expect(() => insertLinearWrite(db, { ...row, id: "write-2" })).toThrow();
});

it("lists an issue's attempts oldest first", () => {
  const { db } = t.client;
  insertLinearWrite(db, {
    id: "write-1",
    issue_id: "i1",
    run_id: null,
    kind: "fields",
    idempotency_key: "k1",
    payload_json: {},
    detail: null,
  });
  insertLinearWrite(db, {
    id: "write-2",
    issue_id: "i1",
    run_id: null,
    kind: "status",
    idempotency_key: "k2",
    payload_json: {},
    detail: null,
  });
  expect(listLinearWritesForIssue(db, "i1").map((write) => write.id)).toEqual([
    "write-1",
    "write-2",
  ]);
});
