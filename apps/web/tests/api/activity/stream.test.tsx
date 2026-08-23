import type { ActivityStreamHandlers } from "@otomat/client";
// @vitest-environment happy-dom
import type { ActivitySnapshot } from "@otomat/domain";
import { useActivity } from "@web/api/activity/queries";
import { useActivityStream } from "@web/api/activity/use-activity-stream";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { runActivity } from "#support/activity";
import { mountWithQuery } from "#support/mount";

const listActivity = vi.fn<() => Promise<ActivitySnapshot>>();
const subscribe = vi.fn();
const close = vi.fn();
let handlers: ActivityStreamHandlers | null = null;

vi.mock("@web/api/client", () => ({
  daemon: {
    listActivity: () => listActivity(),
    subscribeActivity: (next: ActivityStreamHandlers) => {
      handlers = next;
      subscribe();
      return { close };
    },
  },
}));

function snapshot(runIds: string[], observedAt: string): ActivitySnapshot {
  return {
    activities: runIds.map((runId) => runActivity({ run_id: runId, updated_at: observedAt })),
    observed_at: observedAt,
  };
}

async function push(pushed: ActivitySnapshot): Promise<void> {
  await act(async () => {
    handlers?.onSnapshot(pushed);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function Probe() {
  useActivityStream();
  const activity = useActivity();
  return <span>{(activity.data?.activities ?? []).map((item) => item.run_id).join(",")}</span>;
}

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  listActivity.mockReset();
  subscribe.mockReset();
  close.mockReset();
  handlers = null;
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

it("renders the snapshot first, then whatever the stream pushes", async () => {
  listActivity.mockResolvedValue(snapshot(["run-1"], "2026-08-20T10:00:00.000Z"));

  const mounted = await mountWithQuery(<Probe />);
  cleanups.push(mounted.cleanup);
  expect(mounted.container.textContent).toBe("run-1");

  await push(snapshot(["run-1", "run-2"], "2026-08-20T10:00:05.000Z"));

  expect(mounted.container.textContent).toBe("run-1,run-2");
  expect(listActivity).toHaveBeenCalledTimes(1);
});

it("lets the stream empty the panel, so finished work stops being reported as live", async () => {
  listActivity.mockResolvedValue(snapshot(["run-1"], "2026-08-20T10:00:00.000Z"));

  const mounted = await mountWithQuery(<Probe />);
  cleanups.push(mounted.cleanup);

  await push(snapshot([], "2026-08-20T10:00:05.000Z"));

  expect(mounted.container.textContent).toBe("");
});

it("closes the stream when the app unmounts", async () => {
  listActivity.mockResolvedValue(snapshot([], "2026-08-20T10:00:00.000Z"));

  const mounted = await mountWithQuery(<Probe />);
  await mounted.cleanup();

  expect(close).toHaveBeenCalledTimes(1);
});

it("keeps the one stream open across a navigation", async () => {
  listActivity.mockResolvedValue(snapshot(["run-1"], "2026-08-20T10:00:00.000Z"));

  const mounted = await mountWithQuery(<Probe />);
  cleanups.push(mounted.cleanup);
  await mounted.rerender(<Probe />);

  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
});
