// @vitest-environment happy-dom
import type {
  WorkspaceEntry,
  WorkspaceInventory,
  WorkspaceReconcileReport,
  WorkspaceSettings,
} from "@otomat/domain";
import { WorkspacesSection } from "@web/components/settings/workspaces/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { mountRoutedWithQuery } from "#support/router";

const listWorkspaces = vi.fn<() => Promise<WorkspaceInventory>>();
const reconcileWorkspaces = vi.fn<() => Promise<WorkspaceReconcileReport>>();
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
    workspaceSettings: () => workspaceSettings(),
    setWorkspaceSettings: (settings: WorkspaceSettings) => setWorkspaceSettings(settings),
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
  workspaceSettings.mockResolvedValue({ auto_delete_after_merge: true });
});

function entry(over: Partial<WorkspaceEntry> & { id: string }): WorkspaceEntry {
  return {
    repository_id: "repo-1",
    repository_name: "otomat",
    repository_path: "/tmp/otomat",
    issue_id: "i1",
    issue_identifier: "OTO-88",
    issue_title: "Reconcile worktrees",
    run_id: "r1",
    branch: "otomat/run/r1",
    path: `/tmp/worktrees/${over.id}`,
    state: "cleanup_required",
    attachment: "record",
    blocker: null,
    reason: "Ready to delete: the cycle is closed and the worktree is clean.",
    registered: true,
    present: true,
    dirty: false,
    head_sha: null,
    last_activity_at: null,
    pull_request: null,
    ...over,
  };
}

function inventory(entries: WorkspaceEntry[]): WorkspaceInventory {
  return {
    entries,
    counts: {
      active: entries.filter((row) => row.state === "active").length,
      cleanup_required: entries.filter((row) => row.state === "cleanup_required").length,
      stale: 0,
      missing: 0,
      unmanaged: entries.filter((row) => row.state === "unmanaged").length,
    },
  };
}

async function renderSection(entries: WorkspaceEntry[]) {
  listWorkspaces.mockResolvedValue(inventory(entries));
  const mounted = await mountRoutedWithQuery(<WorkspacesSection />);
  cleanups.push(mounted.cleanup);
  return mounted;
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
  expect(document.body.textContent).toContain("manages nothing here");
});

it("offers a deletion only for the workspace the daemon already cleared", async () => {
  await renderSection([
    entry({ id: "a" }),
    entry({ id: "b", state: "active", blocker: "cycle_open" }),
  ]);

  expect(
    [...document.body.querySelectorAll("button")].filter(
      (button) => button.textContent?.trim() === "Clean…",
    ),
  ).toHaveLength(1);
});

it("narrows on a search over the branch, and says so when nothing is left", async () => {
  await renderSection([entry({ id: "a", branch: "otomat/run/alpha" })]);
  const search = findLabelled("Search workspaces");
  if (!(search instanceof HTMLInputElement)) throw new Error("search field not found");

  await act(async () => {
    setInputValue(search, "nothing-like-this");
  });

  expect(document.body.textContent).toContain("No workspace matches these filters");
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
