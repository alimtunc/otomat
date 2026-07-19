import { join } from "node:path";

import { expect, it } from "vitest";

import { runDir, runEventsPath, sessionDir, sessionEventsPath } from "#events";

// Independent literals on purpose: this layout is persistent on-disk state that
// crash reconciliation of pre-existing runs depends on. Do not rewrite via the helpers.
it("pins the on-disk run artifact layout", () => {
  expect(runDir("/data", "r1")).toBe(join("/data", "runs", "r1"));
  expect(runEventsPath("/data", "r1")).toBe(join("/data", "runs", "r1", "events.jsonl"));
  expect(sessionDir("/data", "r1", "s1")).toBe(join("/data", "runs", "r1", "sessions", "s1"));
  expect(sessionEventsPath("/data", "r1", "s1")).toBe(
    join("/data", "runs", "r1", "sessions", "s1", "events.jsonl"),
  );
});
