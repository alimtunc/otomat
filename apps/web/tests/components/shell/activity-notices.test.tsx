// @vitest-environment happy-dom
import type { ActivityContract } from "@otomat/domain";
import { useActivityNotices } from "@web/components/shell/activity/use-notices";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { runActivity } from "#support/activity";
import { mount, type Mounted } from "#support/mount";

const success = vi.fn();
const error = vi.fn();
const warning = vi.fn();
const info = vi.fn();
const navigate = vi.fn();
let pathname = "/issues";
let frame: ActivityContract[] = [];

vi.mock("@otomat/ui", () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
    warning: (...args: unknown[]) => warning(...args),
    info: (...args: unknown[]) => info(...args),
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
  warning.mockReset();
  info.mockReset();
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
  expect(success.mock.calls[0]?.[0]).toBe("Run completed — ABC-1");
});

it("opens the activity's own surface from the notice", async () => {
  await observe([runActivity()], [runActivity({ bucket: "recent", status: "completed" })]);

  // SAFETY: the hook passes sonner's options object, whose action carries the handler under test.
  const options = success.mock.calls[0]?.[1] as { action: { onClick: () => void } };
  act(() => options.action.onClick());

  expect(navigate).toHaveBeenCalledWith({ to: "/runs/$runId", params: { runId: "run-1" } });
});

it.each([
  ["review_ready", "attention", info, "Ready for review — ABC-1"],
  ["completed", "recent", success, "Run completed — ABC-1"],
  ["awaiting_permission", "attention", warning, "Action required — ABC-1"],
  ["awaiting_human", "attention", warning, "Action required — ABC-1"],
  ["awaiting_selection", "attention", warning, "Action required — ABC-1"],
  ["failed", "attention", error, "Run failed or is blocked — ABC-1"],
] as const)(
  "tones a run that reached %s by its status, not its bucket",
  async (status, bucket, tone, message) => {
    await observe([runActivity()], [runActivity({ bucket, status })]);

    expect(tone).toHaveBeenCalledTimes(1);
    expect(tone.mock.calls[0]?.[0]).toBe(message);
    for (const other of [success, error, warning, info]) {
      if (other !== tone) expect(other).not.toHaveBeenCalled();
    }
  },
);

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
