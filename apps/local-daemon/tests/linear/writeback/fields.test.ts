import { getIssue } from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LinearWriteConflictError } from "#linear";
import {
  BASE,
  draftRequest,
  linearDetail,
  REMOTE_CHANGED,
  setupLinearWritebackTest,
} from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("blocks a fields publish when the remote issue changed, without writing", async () => {
  test.seedLinearIssue(BASE);
  const updateIssue = vi.fn();
  const service = await test.connectedService({
    issueSnapshot: async () =>
      linearDetail({ updated_at: REMOTE_CHANGED, title: "Changed remotely" }),
    updateIssue,
  });
  service.writeback.saveDraft(
    "li",
    draftRequest({ base_updated_at: BASE, title: "My local edit" }),
  );

  const error = await service.writeback
    .publishFields("li", { overwrite: false })
    .catch((caught) => caught);
  expect(error).toBeInstanceOf(LinearWriteConflictError);
  expect((error as LinearWriteConflictError).remote.title).toBe("Changed remotely");
  expect(updateIssue).not.toHaveBeenCalled();
  expect(service.writeback.writebackState("li")).toMatchObject({
    draft: { title: "My local edit" },
    writes: [{ kind: "fields", status: "failed", error_code: "linear_write_conflict" }],
  });
});

it("overwrites a conflicting remote issue only on explicit confirmation, then clears the draft", async () => {
  test.seedLinearIssue(BASE);
  const updateIssue = vi.fn(async (_key, _id, input) =>
    linearDetail({ updated_at: "2026-07-21T12:00:00.000Z", title: input.title ?? "Mirror" }),
  );
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail({ updated_at: REMOTE_CHANGED }),
    updateIssue,
  });
  service.writeback.saveDraft(
    "li",
    draftRequest({ base_updated_at: BASE, title: "My local edit" }),
  );

  const state = await service.writeback.publishFields("li", { overwrite: true });
  expect(updateIssue).toHaveBeenCalledOnce();
  expect(updateIssue.mock.calls[0][2]).toMatchObject({ title: "My local edit" });
  expect(state.draft).toBeNull();
  expect(state.writes[0].status).toBe("sent");
  expect(getIssue(test.db, "li")?.title).toBe("My local edit");
});

it("treats a fields publish whose values already match the remote as a reconciled no-op", async () => {
  test.seedLinearIssue(BASE);
  const updateIssue = vi.fn();
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail({ updated_at: REMOTE_CHANGED }),
    updateIssue,
  });
  service.writeback.saveDraft("li", draftRequest({ base_updated_at: BASE }));

  const state = await service.writeback.publishFields("li", { overwrite: false });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes[0].status).toBe("sent");
  expect(state.draft).toBeNull();
});
