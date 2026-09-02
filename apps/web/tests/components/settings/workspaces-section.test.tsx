// @vitest-environment happy-dom
import {
  countWorkspaces,
  type ExecutionHostCallResult,
  type ExecutionHostId,
  type OtomatDesktopBridge,
  type WorkspaceCleanupResult,
  type WorkspaceEntry,
  type WorkspaceInventory,
  type WorkspaceReconcileReport,
  type WorkspaceSettings,
} from "@otomat/domain";
import { hostKeys } from "@web/api/query-keys";
import { WorkspacesSection } from "@web/components/settings/workspaces/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge, twoHostSnapshot } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { testQueryClient } from "#support/query";
import { mountRoutedWithQuery } from "#support/router";
import { workspaceEntry as entry } from "#support/workspace";

const listWorkspaces = vi.fn<() => Promise<WorkspaceInventory>>();
const reconcileWorkspaces = vi.fn<() => Promise<WorkspaceReconcileReport>>();
const cleanupWorkspace = vi.fn<(worktreeId: string) => Promise<WorkspaceCleanupResult>>();
const workspaceSettings = vi.fn<() => Promise<WorkspaceSettings>>(async () => ({
  auto_delete_after_merge: true,
}));
const setWorkspaceSettings = vi.fn<(settings: WorkspaceSettings) => Promise<WorkspaceSettings>>(
  async (settings) => settings,
);

vi.mock("@web/api/client", () => ({
  daemon: {
    listWorkspaces: () => listWorkspaces(),
    reconcileWorkspaces: () => reconcileWorkspaces(),
    cleanupWorkspace: (worktreeId: string) => cleanupWorkspace(worktreeId),
    workspaceSettings: () => workspaceSettings(),
    setWorkspaceSettings: (settings: WorkspaceSettings) => setWorkspaceSettings(settings),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
  vi.clearAllMocks();
  workspaceSettings.mockResolvedValue({ auto_delete_after_merge: true });
});

function inventory(entries: WorkspaceEntry[]): WorkspaceInventory {
  return { entries, counts: countWorkspaces(entries) };
}

async function renderSection(entries: WorkspaceEntry[], client = testQueryClient()) {
  listWorkspaces.mockResolvedValue(inventory(entries));
  const mounted = await mountRoutedWithQuery(<WorkspacesSection />, client);
  cleanups.push(mounted.cleanup);
  return mounted;
}

function withRemoteHost(
  overrides: Partial<OtomatDesktopBridge["executionHost"]>,
  activeId: ExecutionHostId = "local",
) {
  const bridge = fakeDesktopBridge({ executionHostId: activeId });
  Object.assign(bridge.executionHost, {
    snapshot: () => Promise.resolve(twoHostSnapshot({ active_id: activeId })),
    ...overrides,
  });
  window.otomat = bridge;
}

it("counts the maintenance states and says why each workspace is where it is", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({
      id: "b",
      state: "unmanaged",
      attachment: "none",
      blocker: "unmanaged_worktree",
      issue_id: null,
      issue_identifier: null,
      issue_title: null,
      reason: "Otomat did not create this worktree, so it manages nothing here.",
    }),
  ]);

  expect(document.body.textContent).toContain("Cleanup required");
  expect(document.body.textContent).toContain("Unmanaged");
  const stateChips = [...document.body.querySelectorAll("span[aria-label]")];
  expect(
    stateChips.some((chip) =>
      chip
        .getAttribute("aria-label")
        ?.includes("manages nothing here. Remove it yourself if you no longer need it."),
    ),
  ).toBe(true);
});

it("offers a deletion for the workspaces Otomat still holds, and none for the rest", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({ id: "b", state: "active", blocker: "cycle_open" }),
    entry({ id: "c", state: "stale", present: false }),
    entry({ id: "d", state: "unmanaged", attachment: "none", blocker: "unmanaged_worktree" }),
  ]);

  expect(
    document.body.querySelectorAll('button[aria-label="Delete this workspace…"]'),
  ).toHaveLength(2);
});

it("says what a reconciliation does before it is clicked", async () => {
  await renderSection([entry({ id: "a" })]);

  const described = findButton("Reconcile worktrees")?.getAttribute("aria-describedby");
  expect(described).toBeTruthy();
  expect(document.getElementById(described ?? "")?.textContent).toContain(
    "Nothing on disk is deleted, except a clean worktree whose pull request is merged",
  );
});

it("offers in one click only what a merge already made safe", async () => {
  await renderSection([
    entry({ id: "a", pull_request: { number: 7, url: null, merged: true } }),
    entry({ id: "unmerged" }),
    entry({
      id: "b",
      blocker: "worktree_dirty",
      dirty: true,
      reason: "The worktree holds uncommitted changes.",
    }),
    entry({ id: "c", state: "active", blocker: "cycle_open" }),
  ]);

  expect(findButton("Clean up 1")).toBeDefined();
});

it("narrows on a search over the branch, and says so when nothing is left", async () => {
  await renderSection([entry({ id: "a", branch: "otomat/run/alpha" })]);
  const search = findLabelled("Search workspaces");
  if (!(search instanceof HTMLInputElement)) throw new Error("search field not found");

  await act(async () => {
    setInputValue(search, "nothing-like-this");
  });

  expect(document.body.textContent).toContain("No workspace on Local matches these filters");
});

it("reports exactly what a reconciliation did", async () => {
  const report: WorkspaceReconcileReport = {
    pull_requests_refreshed: 2,
    pruned: 1,
    converged: 1,
    cleaned: 1,
    skipped: 0,
    failed: 0,
    inventory: inventory([]),
  };
  reconcileWorkspaces.mockResolvedValue(report);
  await renderSection([entry({ id: "a" })]);

  await act(async () => {
    findButton("Reconcile worktrees")?.click();
  });

  expect(reconcileWorkspaces).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("2 pull request(s) re-read");
  expect(document.body.textContent).toContain("1 cleaned");
});

it("persists the auto-delete setting the operator turned off", async () => {
  await renderSection([]);
  const toggle = findLabelled("Automatically delete workspaces after merge");
  if (toggle === undefined) throw new Error("auto-delete switch not found");

  await act(async () => {
    toggle.click();
  });

  expect(setWorkspaceSettings).toHaveBeenCalledWith({ auto_delete_after_merge: false });
});

it("shows both hosts' workspaces, keeping same-path rows distinct under their owner", async () => {
  withRemoteHost({
    readWorkspaces: () =>
      Promise.resolve({
        ok: true,
        value: inventory([
          entry({ id: "twin", repository_name: "otomat-copy", branch: "otomat/run/twin" }),
        ]),
      }),
  });
  await renderSection([entry({ id: "twin", branch: "otomat/run/twin" })]);

  expect(
    [...document.body.querySelectorAll("section")].map(
      (host) => host.querySelector("span")?.textContent,
    ),
  ).toEqual(["Local", "otomat-vps"]);
  expect(document.body.textContent).toContain("otomat-copy");
  expect(
    [...document.body.querySelectorAll("td")].filter((cell) =>
      cell.textContent?.includes("otomat/run/twin"),
    ),
  ).toHaveLength(2);
});

it("counts every host's workspaces in the global counters", async () => {
  withRemoteHost({
    readWorkspaces: () =>
      Promise.resolve({ ok: true, value: inventory([entry({ id: "r1" }), entry({ id: "r2" })]) }),
  });
  await renderSection([entry({ id: "l1" })]);

  const counter = [...document.body.querySelectorAll("button")].find((button) =>
    button.textContent?.startsWith("Cleanup required"),
  );
  expect(counter?.textContent).toContain("3");
});

it("keeps an unreachable host's last known workspaces behind a stale notice", async () => {
  const readWorkspaces = vi.fn(() =>
    Promise.resolve<ExecutionHostCallResult<WorkspaceInventory>>({
      ok: true,
      value: inventory([entry({ id: "remote-1", branch: "otomat/run/remote" })]),
    }),
  );
  withRemoteHost({ readWorkspaces });
  const client = testQueryClient();
  await renderSection([], client);

  readWorkspaces.mockResolvedValue({
    ok: false,
    message: "The remote host is not connected yet. Try again once its tunnel is up.",
  });
  await act(async () => {
    await client.refetchQueries({ queryKey: hostKeys("remote").workspaces });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(document.body.textContent).toContain("Couldn’t refresh — showing data from");
  expect(document.body.textContent).toContain("otomat/run/remote");
});

it("reads the local host through the bridge when the remote host is the active one", async () => {
  const readWorkspaces = vi.fn((hostId: ExecutionHostId) =>
    Promise.resolve<ExecutionHostCallResult<WorkspaceInventory>>({
      ok: true,
      value: inventory(hostId === "local" ? [entry({ id: "on-local" })] : []),
    }),
  );
  withRemoteHost({ readWorkspaces }, "remote");
  await renderSection([]);

  expect(readWorkspaces).toHaveBeenCalledWith("local");
  expect(readWorkspaces).not.toHaveBeenCalledWith("remote");
  expect(document.body.textContent).toContain("/tmp/worktrees/on-local");
});

it("sends a reconcile and a cleanup to the host that owns the worktree", async () => {
  const reconcileOnHost = vi.fn(() =>
    Promise.resolve<ExecutionHostCallResult<WorkspaceReconcileReport>>({
      ok: true,
      value: {
        pull_requests_refreshed: 0,
        pruned: 0,
        converged: 0,
        cleaned: 1,
        skipped: 0,
        failed: 0,
        inventory: inventory([]),
      },
    }),
  );
  const cleanupOnHost = vi.fn(() =>
    Promise.resolve<ExecutionHostCallResult<WorkspaceCleanupResult>>({
      ok: true,
      value: { outcome: "cleaned", blocker: null, message: "Deleted.", entry: null },
    }),
  );
  withRemoteHost({
    readWorkspaces: () =>
      Promise.resolve({ ok: true, value: inventory([entry({ id: "remote-1" })]) }),
    reconcileWorkspaces: reconcileOnHost,
    cleanupWorkspace: cleanupOnHost,
  });
  await renderSection([]);

  const [, remoteReconcile] = [...document.body.querySelectorAll("button")].filter(
    (button) => button.textContent?.trim() === "Reconcile worktrees",
  );
  if (remoteReconcile === undefined) throw new Error("the remote host has no Reconcile button");
  await act(async () => {
    remoteReconcile.click();
  });
  await act(async () => {
    findLabelled("Delete this workspace…")?.click();
  });
  await act(async () => {
    findButton("Delete workspace")?.click();
  });

  expect(reconcileOnHost).toHaveBeenCalledWith("remote");
  expect(cleanupOnHost).toHaveBeenCalledWith("remote", "remote-1");
  expect(reconcileWorkspaces).not.toHaveBeenCalled();
  expect(cleanupWorkspace).not.toHaveBeenCalled();
});
