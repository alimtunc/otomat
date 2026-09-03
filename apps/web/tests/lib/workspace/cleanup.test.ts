import type { WorkspaceEntry } from "@otomat/domain";
import { describeCleanupLoss, splitCleanupTargets } from "@web/lib/workspace/cleanup";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { expect, it } from "vitest";

import { workspaceEntry } from "#support/workspace";

function row(id: string, over: Partial<WorkspaceEntry> = {}): WorkspaceRow {
  return {
    ...workspaceEntry({ id, ...over }),
    host: { id: "local", label: "Local", kind: "local" },
  };
}

it("splits a selection into what deletes, what needs a confirmation and what never deletes", () => {
  const targets = splitCleanupTargets([
    row("ready"),
    row("dirty", { blocker: "worktree_dirty", uncommitted_files: 1 }),
    row("gone", { state: "stale", present: false }),
    row("busy", { state: "active", blocker: "cycle_open" }),
    row("external", {
      state: "unmanaged",
      provenance: "external_worktree",
      blocker: "unmanaged_worktree",
    }),
  ]);

  expect(targets.ready.map((target) => target.id)).toEqual(["ready"]);
  expect(targets.forced.map((target) => target.id)).toEqual(["dirty", "gone"]);
  expect(targets.refused.map((target) => target.id)).toEqual(["busy", "external"]);
});

it("names the loss a force would cause, and says nothing when there is none", () => {
  const loss = describeCleanupLoss([
    row("a", { uncommitted_files: 3, unpushed_commits: 1 }),
    row("b", { uncommitted_files: 1, unpushed_commits: 0 }),
    row("c", { uncommitted_files: null }),
  ]);

  expect(loss).toBe(
    "4 uncommitted files, 1 commit nothing else holds and 1 worktree git could not read",
  );
  expect(describeCleanupLoss([row("clean")])).toBeNull();
});
