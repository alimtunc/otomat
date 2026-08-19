import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { startIntervalPass } from "#supervisor";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("passes at startup, then once per interval, and never two passes at a time", async () => {
  let calls = 0;
  const running: Array<() => void> = [];
  const loop = startIntervalPass(
    "workspace reconciliation",
    () => {
      calls += 1;
      return new Promise<void>((resolve) => running.push(resolve));
    },
    1000,
  );

  expect(calls).toBe(1);

  await vi.advanceTimersByTimeAsync(3000);
  expect(calls).toBe(1);

  running.shift()?.();
  await vi.advanceTimersByTimeAsync(1000);
  expect(calls).toBe(2);

  running.shift()?.();
  loop.stop();
  await vi.advanceTimersByTimeAsync(5000);
  expect(calls).toBe(2);
});

it("keeps ticking after a pass that failed, so a merge is not lost with the error", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  let calls = 0;
  const loop = startIntervalPass(
    "workspace reconciliation",
    () => {
      calls += 1;
      return Promise.reject(new Error("gh is offline"));
    },
    1000,
  );

  await vi.advanceTimersByTimeAsync(1000);
  loop.stop();

  expect(calls).toBe(2);
  expect(logged).toHaveBeenCalled();
});
