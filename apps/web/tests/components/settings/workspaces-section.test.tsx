// @vitest-environment happy-dom
import {
  countWorkspaces,
  type ProjectContract,
  type WorkspaceCleanupResult,
  type WorkspaceEntry,
  type WorkspaceInventory,
  type WorkspaceReconcileReport,
  type WorkspaceSettings,
} from "@otomat/domain";
import { WorkspacesSection } from "@web/components/settings/workspaces/section";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { setInputValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { mountRoutedWithQuery } from "#support/router";
import { workspaceEntry as entry } from "#support/workspace";

const PROJECT: ProjectContract = {
  id: "proj-1",
  name: "otomat",
  root_path: "/tmp/otomat",
  has_repository: true,
};

let projects: ProjectContract[] = [PROJECT];

const listWorkspaces = vi.fn<(params: { projectId?: string }) => Promise<WorkspaceInventory>>();
const reconcileWorkspaces = vi.fn<() => Promise<WorkspaceReconcileReport>>();
const cleanupWorkspace =
  vi.fn<(workspaceId: string, force: boolean) => Promise<WorkspaceCleanupResult>>();
const workspaceSettings = vi.fn<(projectId: string) => Promise<WorkspaceSettings>>(async () => ({
  auto_delete_after_merge: true,
}));
const setWorkspaceSettings = vi.fn<
  (projectId: string, settings: WorkspaceSettings) => Promise<WorkspaceSettings>
>(async (_projectId, settings) => settings);

vi.mock("@web/api/client", () => ({
  daemon: {
    listProjects: () => Promise.resolve(projects),
    listWorkspaces: (params: { projectId?: string }) => listWorkspaces(params),
    reconcileWorkspaces: () => reconcileWorkspaces(),
    cleanupWorkspace: (workspaceId: string, force: boolean) => cleanupWorkspace(workspaceId, force),
    workspaceSettings: (projectId: string) => workspaceSettings(projectId),
    setWorkspaceSettings: (projectId: string, settings: WorkspaceSettings) =>
      setWorkspaceSettings(projectId, settings),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  projects = [PROJECT];
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  delete window.otomat;
  vi.clearAllMocks();
  workspaceSettings.mockResolvedValue({ auto_delete_after_merge: true });
  setWorkspaceSettings.mockImplementation(async (_projectId, settings) => settings);
});

function inventory(entries: WorkspaceEntry[]): WorkspaceInventory {
  return { entries, counts: countWorkspaces(entries) };
}

async function renderSection(entries: WorkspaceEntry[]) {
  listWorkspaces.mockResolvedValue(inventory(entries));
  const mounted = await mountRoutedWithQuery(<WorkspacesSection />);
  cleanups.push(mounted.cleanup);
  return mounted;
}

it("asks its host for the selected project's worktrees, and for no others", async () => {
  await renderSection([entry({ id: "a" })]);

  expect(listWorkspaces).toHaveBeenCalledWith({ projectId: "proj-1" });
});

it("asks for nothing while no project is selected", async () => {
  projects = [];
  await renderSection([]);

  expect(document.body.textContent).toContain("No project selected");
  expect(listWorkspaces).not.toHaveBeenCalled();
});

it("counts the maintenance states and says why each workspace is where it is", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({
      id: "b",
      state: "unmanaged",
      provenance: "external_worktree",
      blocker: "unmanaged_worktree",
      issue_id: null,
      issue_identifier: null,
      issue_title: null,
      reason:
        "Git does not hold this worktree under Otomat's worktrees root, so nothing here may delete it.",
    }),
  ]);

  expect(document.body.textContent).toContain("Cleanup required");
  expect(document.body.textContent).toContain("Unmanaged");
  const stateChips = [...document.body.querySelectorAll("span[aria-label]")];
  expect(
    stateChips.some((chip) =>
      chip
        .getAttribute("aria-label")
        ?.includes("nothing here may delete it. Remove it yourself if you no longer need it."),
    ),
  ).toBe(true);
});

it("puts the path last, behind what identifies the row, and keeps it copyable", async () => {
  await renderSection([entry({ id: "a" })]);

  expect([...document.body.querySelectorAll("th")].map((head) => head.textContent)).toEqual([
    "",
    "State",
    "Issue",
    "Branch",
    "Git",
    "PR",
    "Updated",
    "Path",
    "",
  ]);
  expect(findLabelled("Worktree path: /tmp/worktrees/a")).toBeDefined();
  expect(findLabelled("Copy Worktree path")).toBeDefined();
  expect(document.body.querySelector("table")?.className).toContain("table-fixed");
});

it("offers a deletion for the workspaces Otomat still holds, and none for the rest", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({ id: "b", state: "active", blocker: "cycle_open" }),
    entry({ id: "c", state: "stale", present: false }),
    entry({
      id: "d",
      state: "unmanaged",
      provenance: "external_worktree",
      blocker: "unmanaged_worktree",
    }),
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
      uncommitted_files: 2,
      reason: "The worktree holds uncommitted changes.",
    }),
    entry({ id: "c", state: "active", blocker: "cycle_open" }),
  ]);

  expect(document.body.textContent).toContain(
    "1 worktree has a merged pull request and is safe to delete.",
  );
  await act(async () => {
    findButton("Select the 1 safe to delete")?.click();
  });

  expect(findButton("Clean up 1")).toBeDefined();
});

it("selects several rows and deletes them on the owning host in one operation", async () => {
  cleanupWorkspace.mockImplementation(async (workspaceId) => ({
    outcome: workspaceId === "b" ? "failed" : "cleaned",
    blocker: null,
    message: workspaceId === "b" ? "git refused to remove this worktree." : "Removed.",
    entry: null,
  }));
  await renderSection([
    entry({ id: "a" }),
    entry({ id: "b" }),
    entry({ id: "c", state: "active", blocker: "cycle_open" }),
  ]);

  await act(async () => {
    findLabelled("Select every deletable workspace")?.click();
  });

  expect(findButton("Clean up 2")).toBeDefined();
  await act(async () => {
    findButton("Clean up 2")?.click();
  });
  await act(async () => {
    findButton("Delete 2 workspaces")?.click();
  });

  expect(cleanupWorkspace.mock.calls).toEqual([
    ["a", false],
    ["b", false],
  ]);
  expect(document.body.textContent).toContain("git refused to remove this worktree.");
  expect(document.body.textContent).toContain("1 cleaned · 1 failed");
});

it("keeps its receipt on screen while the refetched list drops the rows it deleted", async () => {
  cleanupWorkspace.mockResolvedValue({
    outcome: "cleaned",
    blocker: null,
    message: "Removed.",
    entry: null,
  });
  const left = entry({ id: "b", state: "active", blocker: "cycle_open" });
  await renderSection([entry({ id: "a" }), left]);

  await act(async () => {
    findLabelled("Select otomat/run/a")?.click();
  });
  listWorkspaces.mockResolvedValue(inventory([left]));
  await act(async () => {
    findButton("Clean up 1")?.click();
  });
  await act(async () => {
    findButton("Delete 1 workspace")?.click();
  });

  expect(document.body.textContent).toContain("1 cleaned");
  expect(findButton("Close")).toBeDefined();
  expect(document.body.querySelectorAll("tbody tr")).toHaveLength(1);

  await act(async () => {
    findButton("Close")?.click();
  });

  expect(document.body.textContent).not.toContain("otomat/run/a");
});

it("offers no selection for a worktree no confirmation may delete", async () => {
  await renderSection([
    entry({
      id: "external",
      state: "unmanaged",
      provenance: "external_worktree",
      blocker: "unmanaged_worktree",
    }),
    entry({ id: "unreconciled", state: "unmanaged", provenance: "otomat_unreconciled" }),
  ]);

  expect(findLabelled("Select otomat/run/external")).toBeUndefined();
  expect(findLabelled("Select otomat/run/unreconciled")).toBeDefined();
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
  await vi.waitFor(() => {
    expect(document.body.textContent).toContain("2 pull request(s) re-read");
    expect(document.body.textContent).toContain("1 cleaned");
  });
});

it("persists the auto-delete setting the operator turned off for this project", async () => {
  await renderSection([]);
  const toggle = findLabelled("Automatically delete this project's workspaces after merge");
  if (toggle === undefined) throw new Error("auto-delete switch not found");

  await act(async () => {
    toggle.click();
  });

  expect(workspaceSettings).toHaveBeenCalledWith("proj-1");
  expect(setWorkspaceSettings).toHaveBeenCalledWith("proj-1", { auto_delete_after_merge: false });
});

it("says so when the daemon refuses the auto-delete change", async () => {
  setWorkspaceSettings.mockRejectedValue(new Error("project_not_found"));
  await renderSection([]);

  await act(async () => {
    findLabelled("Automatically delete this project's workspaces after merge")?.click();
  });

  await vi.waitFor(() =>
    expect(document.body.querySelector("[role='alert']")?.textContent).toContain(
      "Could not save this setting",
    ),
  );
});

it("names the host that holds the project, and reconciles on that host alone", async () => {
  const bridge = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  const viaBridge = vi.spyOn(bridge.executionHost, "reconcileWorkspaces");
  window.otomat = bridge;
  reconcileWorkspaces.mockResolvedValue({
    pull_requests_refreshed: 0,
    pruned: 0,
    converged: 0,
    cleaned: 0,
    skipped: 0,
    failed: 0,
    inventory: inventory([]),
  });
  await renderSection([entry({ id: "a" })]);

  const host = document.body.querySelector("section");
  expect(host?.querySelector("span")?.textContent).toBe("otomat-vps");
  await act(async () => {
    findButton("Reconcile worktrees")?.click();
  });

  expect(reconcileWorkspaces).toHaveBeenCalledTimes(1);
  expect(viaBridge).not.toHaveBeenCalled();
});

it("deletes on the host that holds the project rather than through the bridge", async () => {
  const bridge = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  const viaBridge = vi.spyOn(bridge.executionHost, "cleanupWorkspace");
  window.otomat = bridge;
  cleanupWorkspace.mockRejectedValue(new Error("daemon unreachable"));
  await renderSection([entry({ id: "a" })]);

  await act(async () => {
    findLabelled("Select every deletable workspace")?.click();
  });
  await act(async () => {
    findButton("Clean up 1")?.click();
  });
  await act(async () => {
    findButton("Delete 1 workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("a", false);
  expect(viaBridge).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("is the daemon running?");
  expect(document.body.textContent).toContain("0 cleaned · 1 failed");
});
