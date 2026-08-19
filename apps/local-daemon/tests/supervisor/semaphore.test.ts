import { expect, it } from "vitest";

import { Semaphore, type SlotGrant } from "#supervisor/semaphore";

interface SlotHolder {
  grant: SlotGrant | null;
}

function track(promise: Promise<SlotGrant>): SlotHolder {
  const state: SlotHolder = { grant: null };
  void promise.then((grant) => {
    state.grant = grant;
  });
  return state;
}

it("grants queued waiters in FIFO order as slots free up", async () => {
  const slots = new Semaphore(1);
  await expect(slots.acquire("a")).resolves.toBe("acquired");

  const b = track(slots.acquire("b"));
  const c = track(slots.acquire("c"));
  expect(slots.queued()).toEqual(["b", "c"]);

  slots.release();
  await Promise.resolve();
  expect(b.grant).toBe("acquired");
  expect(c.grant).toBe(null);
  expect(slots.queued()).toEqual(["c"]);

  slots.release();
  await Promise.resolve();
  expect(c.grant).toBe("acquired");
  expect(slots.waiting).toBe(0);
});

it("cancel resolves a queued waiter as canceled without granting a slot", async () => {
  const slots = new Semaphore(1);
  await slots.acquire("holder");
  const queued = track(slots.acquire("queued"));
  const behind = track(slots.acquire("behind"));

  expect(slots.cancel("queued")).toBe(true);
  await Promise.resolve();
  expect(queued.grant).toBe("canceled");
  expect(slots.queued()).toEqual(["behind"]);
  expect(slots.active).toBe(1);

  slots.release();
  await Promise.resolve();
  expect(behind.grant).toBe("acquired");
});

it("cancel refuses a holder and an unknown key", async () => {
  const slots = new Semaphore(1);
  await slots.acquire("holder");

  expect(slots.cancel("holder")).toBe(false);
  expect(slots.cancel("stranger")).toBe(false);
  expect(slots.active).toBe(1);
});

it("throws on a release that no acquire backs, instead of corrupting the count", async () => {
  const slots = new Semaphore(2);
  await slots.acquire("a");
  slots.release();

  expect(() => slots.release()).toThrow("released more often than acquired");
  expect(slots.active).toBe(0);
});

it("lowering the limit never evicts a holder; raising it drains the queue at once", async () => {
  const slots = new Semaphore(2);
  await slots.acquire("a");
  await slots.acquire("b");

  slots.resize(1);
  expect(slots.active).toBe(2);

  const c = track(slots.acquire("c"));
  slots.resize(3);
  await Promise.resolve();
  expect(c.grant).toBe("acquired");
  expect(slots.active).toBe(3);
});
