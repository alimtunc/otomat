import { expect, it } from "vitest";

import {
  UNMAPPED_ISSUE_SOURCE_LIFECYCLE,
  type IssueSourceLifecycle,
  type LinearLifecycleWriteError,
} from "#domain/contracts/linear/lifecycle";
import { projectLinearLifecycleReadiness } from "#domain/projections/linear-lifecycle";

const MAPPED: IssueSourceLifecycle = {
  in_progress: { id: "s-doing", name: "Doing" },
  done: { id: "s-shipped", name: "Shipped" },
};

const ERROR: LinearLifecycleWriteError = {
  issue_id: "i-1",
  write_id: "w-1",
  phase: "in_progress",
  message: "Linear rejected the API key.",
};

it("reads an unreadable integration before anything the mapping could claim", () => {
  expect(
    projectLinearLifecycleReadiness({ lifecycle: MAPPED, error: ERROR, available: false }),
  ).toEqual({ status: "unavailable" });
});

it("separates nothing mapped from a half-mapped cycle", () => {
  expect(
    projectLinearLifecycleReadiness({
      lifecycle: UNMAPPED_ISSUE_SOURCE_LIFECYCLE,
      error: null,
      available: true,
    }),
  ).toEqual({ status: "unmapped" });
  expect(
    projectLinearLifecycleReadiness({
      lifecycle: { ...MAPPED, done: null },
      error: null,
      available: true,
    }),
  ).toEqual({ status: "incomplete", missing: ["done"] });
});

it("stays quiet about a failure the phase it targeted no longer claims", () => {
  expect(
    projectLinearLifecycleReadiness({
      lifecycle: { ...MAPPED, in_progress: null },
      error: ERROR,
      available: true,
    }),
  ).toEqual({ status: "incomplete", missing: ["in_progress"] });
});

it("reports a live failure ahead of the phase still left to map", () => {
  expect(
    projectLinearLifecycleReadiness({ lifecycle: MAPPED, error: ERROR, available: true }),
  ).toEqual({ status: "failing", error: ERROR });
  expect(
    projectLinearLifecycleReadiness({
      lifecycle: { ...MAPPED, done: null },
      error: ERROR,
      available: true,
    }),
  ).toEqual({ status: "failing", error: ERROR });
});

it("calls a complete mapping with no failure ready", () => {
  expect(
    projectLinearLifecycleReadiness({ lifecycle: MAPPED, error: null, available: true }),
  ).toEqual({ status: "ready" });
});
