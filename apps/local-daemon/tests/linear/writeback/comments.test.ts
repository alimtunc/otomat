import { insertLinearWrite, updateLinearWrite } from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { COMMENT_UUID, setupLinearWritebackTest } from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("reconciles an interrupted comment against Linear before resending, never duplicating it", async () => {
  test.seedLinearIssue();
  insertLinearWrite(test.db, {
    id: "w-comment",
    issue_id: "li",
    run_id: null,
    kind: "comment",
    idempotency_key: COMMENT_UUID,
    payload_json: { body: "Ran the agent", parent_id: null },
    detail: "Ran the agent",
  });
  updateLinearWrite(test.db, "w-comment", {
    status: "failed",
    error_code: "linear_unavailable",
  });

  const createComment = vi.fn(async () => COMMENT_UUID);
  const service = await test.connectedService({
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

  const state = await service.writeback.retryWrite("w-comment");
  expect(createComment).not.toHaveBeenCalled();
  expect(state.writes[0]).toMatchObject({ id: "w-comment", status: "sent" });
});

it("retries a failed threaded reply with its parent intact", async () => {
  test.seedLinearIssue();
  insertLinearWrite(test.db, {
    id: "w-reply",
    issue_id: "li",
    run_id: null,
    kind: "comment",
    idempotency_key: COMMENT_UUID,
    payload_json: { body: "Sounds good", parent_id: "c-root" },
    detail: "Sounds good",
  });
  updateLinearWrite(test.db, "w-reply", {
    status: "failed",
    error_code: "linear_unavailable",
  });

  const createComment = vi.fn(async () => COMMENT_UUID);
  const service = await test.connectedService({ listComments: async () => [], createComment });

  const state = await service.writeback.retryWrite("w-reply");
  expect(createComment).toHaveBeenCalledWith(
    expect.anything(),
    { id: COMMENT_UUID, issueId: "L-1", body: "Sounds good", parentId: "c-root" },
    expect.anything(),
  );
  expect(state.writes.find((write) => write.id === "w-reply")?.status).toBe("sent");
});

it("lists remote comments sorted by creation time", async () => {
  test.seedLinearIssue();
  const service = await test.connectedService({
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

  const comments = await service.writeback.comments("li");
  expect(comments.map((comment) => comment.id)).toEqual(["c1", "c2"]);
  expect(comments[1]).toMatchObject({ author_name: "Fawsy", parent_id: "c1" });
});

it("publishes a threaded reply with its parent id", async () => {
  test.seedLinearIssue();
  const createComment = vi.fn(async () => COMMENT_UUID);
  const service = await test.connectedService({ listComments: async () => [], createComment });

  await service.writeback.publishComment("li", {
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
