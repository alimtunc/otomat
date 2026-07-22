import { afterEach, beforeEach, expect, it } from "vitest";

import { draftRequest, setupLinearWritebackTest } from "#test-support/linear-writeback";

let test: ReturnType<typeof setupLinearWritebackTest>;

beforeEach(() => {
  test = setupLinearWritebackTest();
});

afterEach(() => test.cleanup());

it("persists a draft that survives a daemon restart and only leaves on discard", async () => {
  test.seedLinearIssue();
  const first = await test.connectedService();
  first.writeback.saveDraft("li", draftRequest({ title: "Edited offline" }));
  expect(first.writeback.writebackState("li").draft?.title).toBe("Edited offline");

  const afterRestart = await test.connectedService();
  expect(afterRestart.writeback.writebackState("li").draft?.title).toBe("Edited offline");

  afterRestart.writeback.discardDraft("li");
  expect(afterRestart.writeback.writebackState("li").draft).toBeNull();
});
