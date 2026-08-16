import { expect, it } from "vitest";

import type { ArtifactWaitReason } from "#main/remote/upgrade/artifact";
import { ArtifactWait } from "#main/remote/upgrade/artifact-wait";

const BUILD = "2f55965";

/** Every delay one reason is worth, ending with the null that closes its window. */
function window(wait: ArtifactWait, reason: ArtifactWaitReason): Array<number | null> {
  const delays: Array<number | null> = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const delay = wait.next(BUILD, reason);
    delays.push(delay);
    if (delay === null) break;
  }
  return delays;
}

it("backs off from seconds to a ceiling instead of polling at one rate", () => {
  const delays = window(new ArtifactWait(), "in_progress");

  expect(delays.slice(0, 5)).toEqual([10_000, 20_000, 30_000, 60_000, 90_000]);
  expect(delays.at(5)).toBe(90_000);
});

it("waits a CI run out, and gives up on a run that never appears in minutes", () => {
  const running = window(new ArtifactWait(), "in_progress");
  const missing = window(new ArtifactWait(), "no_run");

  expect(running.at(-1)).toBeNull();
  expect(missing).toEqual([10_000, 20_000, 30_000, 60_000, null]);
  expect(running.length).toBeGreaterThan(missing.length);
});

it("gives a green run its own propagation window, from the start of the schedule", () => {
  const wait = new ArtifactWait();
  wait.next(BUILD, "in_progress");
  wait.next(BUILD, "in_progress");

  expect(wait.next(BUILD, "not_published")).toBe(10_000);
});

it("forgives a handful of unreadable probes, then stops calling them a wait", () => {
  const delays = window(new ArtifactWait(), "unreadable");

  expect(delays).toEqual([10_000, 20_000, 30_000, null]);
});

it("ends a build that keeps changing its reason, rather than waiting on forever", () => {
  const wait = new ArtifactWait();
  const reasons: ArtifactWaitReason[] = ["no_run", "queued", "in_progress", "not_published"];
  const delays: Array<number | null> = [];

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const reason = reasons[attempt % reasons.length] ?? "no_run";
    const delay = wait.next(BUILD, reason);
    delays.push(delay);
    if (delay === null) break;
  }

  expect(delays.at(-1)).toBeNull();
  expect(delays.length).toBeLessThanOrEqual(25);
});

it("starts a fresh window for another build, and for a wait that was reset", () => {
  const wait = new ArtifactWait();
  window(wait, "no_run");

  expect(wait.next("aaa1111", "no_run")).toBe(10_000);

  wait.reset();
  expect(wait.next(BUILD, "no_run")).toBe(10_000);
});
