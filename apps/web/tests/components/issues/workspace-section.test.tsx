// @vitest-environment happy-dom
import type { WorkspaceEntry, WorkspaceInventory } from "@otomat/domain";
import { WorkspaceSection } from "@web/components/issues/workspace/rail/workspace/section";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton, findLabelled } from "#support/dom-queries";
import { mountRoutedWithQuery } from "#support/router";
import { workspaceEntry } from "#support/workspace";

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
  return { ...workspaceEntry({ id: "wt-1" }), last_activity_at: "2026-08-18 00:00:00", ...over };
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
  expect(document.body.textContent).toContain("otomat/run/wt-1");
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
  expect(document.body.textContent).toContain("merge or abandon its cycle first");
});

it("copies the whole branch name while the rail only shows its truncated tail", async () => {
  const branch = "feat/rendre-le-nom-de-branche-copiable-dans-le-workspace-d-une-issue";
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  await renderSection({ branch });

  expect(document.body.querySelector(`[title="${branch}"]`)?.className).toContain("truncate");
  const copy = findLabelled("Copy branch");
  await act(async () => copy?.click());

  expect(writeText).toHaveBeenCalledWith(branch);
  expect(copy?.getAttribute("data-status")).toBe("copied");
});
