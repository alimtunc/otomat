import { expect, it } from "vitest";

import {
  ISSUE_STATES,
  issueStateFromLinear,
  LINEAR_ISSUE_STATE_TYPES,
} from "#domain/state-machines/issue";

it("maps every documented Linear state type onto a local issue status", () => {
  const mapped = LINEAR_ISSUE_STATE_TYPES.map((type) => issueStateFromLinear(type));

  expect(mapped).toEqual([
    "backlog",
    "backlog",
    "ready",
    "running",
    "done",
    "canceled",
    "canceled",
  ]);
  for (const status of mapped) expect(ISSUE_STATES).toContain(status);
});

it("falls back to backlog for a state type Linear adds later", () => {
  expect(issueStateFromLinear("some_future_type")).toBe("backlog");
  expect(issueStateFromLinear("")).toBe("backlog");
});

it("ignores the personalizable state name and reads only the type", () => {
  expect(issueStateFromLinear("In Progress")).toBe("backlog");
  expect(issueStateFromLinear("started")).toBe("running");
});
