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
import { findButton, findLabelled, findMenuItem } from "#support/dom-queries";
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

function external(path: string, over: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return entry({
    id: path,
    path,
    branch: "by-hand",
    state: "unmanaged",
    provenance: "external_worktree",
    issue_id: null,
    issue_identifier: null,
    issue_title: null,
    run_id: null,
    reason:
      "Git registers this worktree but Otomat did not create it; removing it leaves its branch alone.",
    ...over,
  });
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
    external("/tmp/worktrees/b", {
      blocker: "worktree_dirty",
      uncommitted_files: 2,
      reason: "Uncommitted changes are still in this worktree.",
    }),
  ]);

  expect(document.body.textContent).toContain("Cleanup required");
  expect(document.body.textContent).toContain("Unmanaged");
  const stateChips = [...document.body.querySelectorAll("span[aria-label]")];
  expect(
    stateChips.some((chip) =>
      chip
        .getAttribute("aria-label")
        ?.includes("still in this worktree. Commit or discard the changes in the worktree first."),
    ),
  ).toBe(true);
});

it("keeps paths copyable in the actions menu without a permanent column", async () => {
  await renderSection([entry({ id: "a" })]);

  expect([...document.body.querySelectorAll("th")].map((head) => head.textContent)).toEqual([
    "",
    "State",
    "Issue",
    "Branch",
    "Git",
    "PR",
    "Updated",
    "",
  ]);
  await act(async () => {
    findLabelled("Workspace actions")?.click();
  });
  expect(document.body.textContent).toContain("/tmp/worktrees/a");
  expect(findLabelled("Copy Worktree path")).toBeDefined();
  expect(document.body.querySelector("table")?.className).toContain("table-fixed");
});

it("offers a menu deletion for the workspaces Otomat holds, and a row action for an unmanaged one", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({ id: "b", state: "active", blocker: "cycle_open" }),
    entry({ id: "c", state: "stale", present: false }),
    external("/tmp/worktrees/d"),
  ]);

  const actions = [
    ...document.body.querySelectorAll<HTMLButtonElement>('button[aria-label="Workspace actions"]'),
  ];
  const offered: boolean[] = [];
  for (const action of actions) {
    await act(async () => {
      action.click();
    });
    offered.push(findMenuItem("Delete this workspace…") !== undefined);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
  }
  expect(offered).toEqual([true, false, true, false]);
  expect(document.body.querySelectorAll('[aria-label="Remove worktree"]')).toHaveLength(1);
});

it("says what a refresh does before it is clicked, and that it deletes nothing", async () => {
  await renderSection([entry({ id: "a" })]);
  const refresh = findButton("Refresh worktrees");

  const described = refresh?.getAttribute("aria-describedby");
  expect(document.getElementById(described ?? "")?.textContent).toContain(
    "Refresh re-reads git worktree list and this host’s pull requests, then updates the states shown here.",
  );
  await act(async () => refresh?.focus());

  expect(document.body.textContent).toContain(
    "Rescan Git worktrees and refresh this list. Does not delete or change any worktree.",
  );
});

it("names the merged cleanup and lists its targets before asking for the confirmation", async () => {
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
    findButton("Clean up merged worktrees")?.click();
  });

  const dialog = document.body.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("#7 merged");
  expect(dialog?.textContent).not.toContain("otomat/run/unmerged");
  expect(findButton("Delete 1 clean workspace")).toBeDefined();
  expect(cleanupWorkspace).not.toHaveBeenCalled();
});

it("removes a clean unmanaged worktree from its row after one confirmation", async () => {
  cleanupWorkspace.mockResolvedValue({
    outcome: "cleaned",
    blocker: null,
    message: "Removed /tmp/worktrees/by-hand; its branch was left alone.",
    entry: null,
  });
  await renderSection([external("/tmp/worktrees/by-hand")]);

  await act(async () => {
    findLabelled("Remove worktree")?.click();
  });
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("by-hand");
  await act(async () => {
    findButton("Delete 1 clean workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("/tmp/worktrees/by-hand", false);
  expect(document.body.textContent).toContain("1 cleaned");
});

it("removes a dirty unmanaged worktree only after the operator confirms the branch, path and loss", async () => {
  cleanupWorkspace.mockResolvedValue({
    outcome: "cleaned",
    blocker: null,
    message: "Removed /tmp/worktrees/by-hand; its branch was left alone.",
    entry: null,
  });
  await renderSection([
    external("/tmp/worktrees/by-hand", { blocker: "worktree_dirty", uncommitted_files: 3 }),
  ]);

  await act(async () => {
    findLabelled("Remove worktree")?.click();
  });
  const armed = findButton("Delete 0 workspaces");
  expect(armed?.getAttribute("disabled")).not.toBeNull();
  expect(document.body.textContent).toContain(
    "Discard 3 uncommitted files in this worktree. This cannot be undone.",
  );
  expect(document.body.textContent).toContain("by-hand · /tmp/worktrees/by-hand");
  await act(async () => {
    findButton("Keep them")?.click();
  });
  expect(cleanupWorkspace).not.toHaveBeenCalled();

  await act(async () => {
    findLabelled("Remove worktree")?.click();
  });
  await act(async () => {
    findLabelled("Force delete by-hand")?.click();
  });
  await act(async () => {
    findButton("Force delete 1 workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("/tmp/worktrees/by-hand", true);
  expect(document.body.textContent).toContain("1 cleaned");
});

it("shows git's refusal of an unmanaged removal instead of a deletion it never made", async () => {
  cleanupWorkspace.mockResolvedValue({
    outcome: "failed",
    blocker: null,
    message: "fatal: cannot remove a locked working tree",
    entry: null,
  });
  await renderSection([external("/tmp/worktrees/by-hand")]);

  await act(async () => {
    findLabelled("Remove worktree")?.click();
  });
  await act(async () => {
    findButton("Delete 1 clean workspace")?.click();
  });

  expect(document.body.textContent).toContain("fatal: cannot remove a locked working tree");
  expect(document.body.textContent).toContain("0 cleaned · 1 failed");
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
    findButton("Delete 2 clean workspaces")?.click();
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
    findButton("Delete 1 clean workspace")?.click();
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
    entry({ id: "writing", blocker: "writer_alive" }),
    entry({ id: "unreconciled", state: "unmanaged", provenance: "otomat_unreconciled" }),
  ]);

  expect(findLabelled("Select otomat/run/writing")).toBeUndefined();
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

it("reports exactly what a refresh did, and never a deletion", async () => {
  const report: WorkspaceReconcileReport = {
    pull_requests_refreshed: 2,
    pruned: 1,
    converged: 1,
    inventory: inventory([]),
  };
  reconcileWorkspaces.mockResolvedValue(report);
  await renderSection([entry({ id: "a" })]);

  await act(async () => {
    findButton("Refresh worktrees")?.click();
  });

  expect(reconcileWorkspaces).toHaveBeenCalledTimes(1);
  expect(cleanupWorkspace).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(document.body.textContent).toContain(
      "2 pull requests re-read · 1 gone registration pruned · 1 record converged",
    );
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
    inventory: inventory([]),
  });
  await renderSection([entry({ id: "a" })]);

  const host = document.body.querySelector("section");
  expect(host?.querySelector("span")?.textContent).toBe("otomat-vps");
  await act(async () => {
    findButton("Refresh worktrees")?.click();
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
    findButton("Delete 1 clean workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("a", false);
  expect(viaBridge).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("is the daemon running?");
  expect(document.body.textContent).toContain("0 cleaned · 1 failed");
});

it("removes an unmanaged worktree on the host that holds the project rather than through the bridge", async () => {
  const bridge = fakeDesktopBridge({
    executionHostId: "remote",
    executionHostSshAlias: "otomat-vps",
  });
  const viaBridge = vi.spyOn(bridge.executionHost, "cleanupWorkspace");
  window.otomat = bridge;
  cleanupWorkspace.mockResolvedValue({
    outcome: "cleaned",
    blocker: null,
    message: "Removed.",
    entry: null,
  });
  await renderSection([external("/srv/by-hand")]);

  await act(async () => {
    findLabelled("Remove worktree")?.click();
  });
  await act(async () => {
    findButton("Delete 1 clean workspace")?.click();
  });

  expect(cleanupWorkspace).toHaveBeenCalledWith("/srv/by-hand", false);
  expect(viaBridge).not.toHaveBeenCalled();
});
