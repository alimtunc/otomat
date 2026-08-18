// @vitest-environment happy-dom
import type { WorkspaceEntry, WorkspaceInventory } from "@otomat/domain";
import { WorkspaceSection } from "@web/components/issues/workspace/rail/workspace/section";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mountRoutedWithQuery } from "#support/router";

const listWorkspaces = vi.fn<() => Promise<WorkspaceInventory>>();

vi.mock("@web/api/client", () => ({
  daemon: {
    listWorkspaces: () => listWorkspaces(),
    reconcileWorkspaces: async () => {
      throw new Error("not expected in this test");
    },
  },
}));

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function entry(over: Partial<WorkspaceEntry> = {}): WorkspaceEntry {
  return {
    id: "wt-1",
    repository_id: "repo-1",
    repository_name: "otomat",
    repository_path: "/tmp/otomat",
    issue_id: "i1",
    issue_identifier: "OTO-88",
    issue_title: "Reconcile worktrees",
    run_id: "r1",
    branch: "otomat/run/r1",
    path: "/tmp/worktrees/r1",
    state: "cleanup_required",
    attachment: "record",
    blocker: null,
    reason: "Ready to delete: the cycle is closed and the worktree is clean.",
    registered: true,
    present: true,
    dirty: false,
    head_sha: null,
    last_activity_at: "2026-08-18 00:00:00",
    pull_request: null,
    ...over,
  };
}

async function renderSection(over: Partial<WorkspaceEntry> = {}) {
  listWorkspaces.mockResolvedValue({
    entries: [entry(over)],
    counts: { active: 0, cleanup_required: 1, stale: 0, missing: 0, unmanaged: 0 },
  });
  const mounted = await mountRoutedWithQuery(<WorkspaceSection runId="r1" />);
  cleanups.push(mounted.cleanup);
}

it("offers the deletion once the daemon names no blocker", async () => {
  await renderSection();

  expect(document.body.textContent).toContain("Cleanup required");
  expect(document.body.textContent).toContain("otomat/run/r1");
  expect(findButton("Clean workspace…")).toBeDefined();
});

it("explains the blocker and points at the action that lifts it, instead of offering a deletion", async () => {
  await renderSection({
    state: "active",
    blocker: "cycle_open",
    reason: "The issue is still working here — merge or abandon its cycle first.",
  });

  expect(findButton("Clean workspace…")).toBeUndefined();
  expect(findButton("Reconcile")).toBeDefined();
  expect(document.body.textContent).toContain("Merge or abandon the cycle");
});
