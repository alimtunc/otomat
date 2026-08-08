// @vitest-environment happy-dom
import { focusManager } from "@tanstack/react-query";
import { useLinearAutoSync } from "@web/components/shell/use-linear-auto-sync";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

let connectionStatus: string;
let projectId: string | undefined;
const refreshIfStale = vi.fn();
const seenProjectIds: (string | undefined)[] = [];

vi.mock("@web/api/linear/queries", () => ({
  useLinearConnection: () => ({ data: { status: connectionStatus } }),
}));

vi.mock("@web/components/shell/project-selection/use-selected", () => ({
  useSelectedProject: () => ({ projectId, projects: { isSuccess: true, data: [] } }),
}));

vi.mock("@web/api/linear/use-project-sync", () => ({
  useProjectLinearSync: (id: string | undefined) => {
    seenProjectIds.push(id);
    return { status: null, running: false, refresh: vi.fn(), refreshIfStale };
  },
}));

function AutoSyncProbe() {
  useLinearAutoSync();
  return <span>probe</span>;
}

let rendered: Mounted | null = null;

async function renderProbe(): Promise<void> {
  rendered = await mount(<AutoSyncProbe />);
}

async function rerender(): Promise<void> {
  await rendered?.cleanup();
  rendered = null;
  await renderProbe();
}

async function returnToForeground(): Promise<void> {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

beforeEach(() => {
  connectionStatus = "connected";
  projectId = "p1";
  refreshIfStale.mockClear();
  seenProjectIds.length = 0;
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  focusManager.setFocused(undefined);
  document.body.replaceChildren();
});

it("refreshes as soon as the Linear connection is usable", async () => {
  await renderProbe();

  expect(refreshIfStale).toHaveBeenCalled();
});

it("stays quiet while Linear is not connected", async () => {
  connectionStatus = "disconnected";

  await renderProbe();

  expect(refreshIfStale).not.toHaveBeenCalled();
});

it("refreshes the newly selected project, and only that one", async () => {
  await renderProbe();
  refreshIfStale.mockClear();
  seenProjectIds.length = 0;

  projectId = "p2";
  await rerender();

  expect(refreshIfStale).toHaveBeenCalled();
  expect(new Set(seenProjectIds)).toEqual(new Set(["p2"]));
});

it("refreshes when the window comes back to the foreground", async () => {
  await renderProbe();
  refreshIfStale.mockClear();

  await returnToForeground();

  expect(refreshIfStale).toHaveBeenCalledTimes(1);
});

it("stays quiet when the window leaves the foreground", async () => {
  await renderProbe();
  refreshIfStale.mockClear();

  await act(async () => {
    focusManager.setFocused(false);
  });

  expect(refreshIfStale).not.toHaveBeenCalled();
});

it("detaches its foreground listener on unmount", async () => {
  await renderProbe();
  await rendered?.cleanup();
  rendered = null;
  refreshIfStale.mockClear();

  await returnToForeground();

  expect(refreshIfStale).not.toHaveBeenCalled();
});
