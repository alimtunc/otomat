// @vitest-environment happy-dom
import type { ActivityContract } from "@otomat/domain";
import { useActivityNotices } from "@web/components/shell/activity/use-notices";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { runActivity } from "#support/activity";
import { mount, type Mounted } from "#support/mount";

const success = vi.fn();
const error = vi.fn();
const navigate = vi.fn();
let pathname = "/issues";
let frame: ActivityContract[] = [];

vi.mock("@otomat/ui", () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  },
}));

vi.mock("@web/api/activity/queries", () => ({
  useActivity: () => ({ data: { activities: frame, observed_at: "2026-08-20T10:00:00.000Z" } }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname } }),
}));

function Probe(): ReactNode {
  useActivityNotices();
  return null;
}

let rendered: Mounted | null = null;

/** Each call is one snapshot the host pushed; the hook only ever sees the newest. */
async function observe(...frames: ActivityContract[][]): Promise<void> {
  for (const [index, activities] of frames.entries()) {
    frame = activities;
    if (index === 0) rendered = await mount(<Probe />);
    else await rendered?.rerender(<Probe />);
  }
}

beforeEach(() => {
  success.mockReset();
  error.mockReset();
  navigate.mockReset();
  pathname = "/issues";
  frame = [];
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
});

it("says nothing about the work the first snapshot already knew", async () => {
  await observe([runActivity({ bucket: "recent", status: "completed" })]);

  expect(success).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

it("announces a run that finished while the operator was elsewhere", async () => {
  await observe([runActivity()], [runActivity({ bucket: "recent", status: "completed" })]);

  expect(success).toHaveBeenCalledTimes(1);
  expect(success.mock.calls[0]?.[0]).toBe("Run finished — ABC-1");
});

it("opens the activity's own surface from the notice", async () => {
  await observe([runActivity()], [runActivity({ bucket: "recent", status: "completed" })]);

  // SAFETY: the hook passes sonner's options object, whose action carries the handler under test.
  const options = success.mock.calls[0]?.[1] as { action: { onClick: () => void } };
  act(() => options.action.onClick());

  expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId: "run-1" } });
});

it("reports work that stopped as a failure, not a success", async () => {
  await observe([runActivity()], [runActivity({ bucket: "attention", status: "failed" })]);

  expect(error).toHaveBeenCalledTimes(1);
  expect(success).not.toHaveBeenCalled();
});

it("stays quiet while the operator is already looking at that surface", async () => {
  pathname = "/runs/run-1";

  await observe([runActivity()], [runActivity({ bucket: "recent", status: "completed" })]);

  expect(success).not.toHaveBeenCalled();
});

it("counts a run's subpages as its surface", async () => {
  pathname = "/runs/run-1/diff";

  await observe([runActivity()], [runActivity({ bucket: "recent", status: "completed" })]);

  expect(success).not.toHaveBeenCalled();
});

it("stays quiet for work that only moved between live buckets", async () => {
  await observe(
    [runActivity({ bucket: "queued", status: "queued" })],
    [runActivity({ bucket: "running", status: "running" })],
  );

  expect(success).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

function publication(bucket: "running" | "recent"): ActivityContract {
  return {
    kind: "pull_request_publication",
    id: "publication:pr-1",
    bucket,
    operation: {
      id: "pr-1",
      kind: "pull_request_publication",
      state: bucket === "recent" ? "succeeded" : "running",
      phases: [],
      error: null,
      retryable: false,
      updated_at: "2026-08-20T10:00:00.000Z",
    },
    project: { id: "p1", name: "Otomat" },
    issue: { id: "i1", identifier: "ABC-1", title: "Ship it" },
    run_id: "run-1",
    phase: null,
    updated_at: "2026-08-20T10:00:00.000Z",
  };
}

it("announces a publication that landed on another page", async () => {
  await observe([publication("running")], [publication("recent")]);

  expect(success.mock.calls[0]?.[0]).toBe("Pull request published — ABC-1");
});
