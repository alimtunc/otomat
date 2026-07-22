import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { linearDetail, PR_URL, setupLinearWritebackTest } from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("publishes a status idempotently and emits a linear-sourced ledger event for the run", async () => {
  test.seedLinearIssue();
  test.seedRun();
  const updateIssue = vi.fn(async () =>
    linearDetail({ state: { id: "s-done", name: "Done", type: "completed", color: "#0a0" } }),
  );
  const service = await test.connectedService({
    issueSnapshot: async () => linearDetail(),
    updateIssue,
  });

  await service.writeback.publishStatus("li", { state_id: "s-done", run_id: "r1" });
  expect(updateIssue).toHaveBeenCalledOnce();
  expect(test.readLedger("r1")).toContain("linear.status_published");
  expect(test.readLedger("r1")).toContain('"source":"linear"');

  updateIssue.mockClear();
  const state = await service.writeback.publishStatus("li", {
    state_id: "s-done",
    run_id: "r1",
  });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes.filter((write) => write.kind === "status")).toHaveLength(1);
});

it("skips the status mutation when the remote issue is already in the target state", async () => {
  test.seedLinearIssue();
  const updateIssue = vi.fn();
  const service = await test.connectedService({
    issueSnapshot: async () =>
      linearDetail({ state: { id: "s-done", name: "Done", type: "completed", color: "#0a0" } }),
    updateIssue,
  });

  const state = await service.writeback.publishStatus("li", { state_id: "s-done" });
  expect(updateIssue).not.toHaveBeenCalled();
  expect(state.writes[0].status).toBe("sent");
});

it("dedupes a PR-link attachment by URL", async () => {
  test.seedLinearIssue();
  const linkAttachment = vi.fn(async () => "att-1");
  const service = await test.connectedService({ linkAttachment });

  await service.writeback.publishPrLink("li", { url: PR_URL, title: "PR #42" });
  expect(linkAttachment).toHaveBeenCalledOnce();

  linkAttachment.mockClear();
  await service.writeback.publishPrLink("li", { url: PR_URL, title: "PR #42" });
  expect(linkAttachment).not.toHaveBeenCalled();
});
