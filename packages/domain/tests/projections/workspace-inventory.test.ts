import { expect, it } from "vitest";

import {
  describeWorkspace,
  projectWorkspaceState,
  type WorkspaceFacts,
} from "#domain/projections/workspace-inventory";

/** A merged, quiet, clean, closed workspace: the only shape a deletion is allowed to act on. */
function facts(over: Partial<WorkspaceFacts> = {}): WorkspaceFacts {
  return {
    attachment: "record",
    registered: true,
    present: true,
    record_status: "active",
    cycle_open: false,
    pull_request_merged: true,
    dirty: false,
    writer_alive: false,
    ...over,
  };
}

it("clears a merged cycle whose worktree is quiet and clean", () => {
  expect(projectWorkspaceState(facts())).toEqual({ state: "cleanup_required", blocker: null });
});

it("keeps an open cycle active", () => {
  expect(projectWorkspaceState(facts({ cycle_open: true }))).toEqual({
    state: "active",
    blocker: "cycle_open",
  });
});

it("blocks on the live writer before anything else it could report", () => {
  const verdict = projectWorkspaceState(facts({ writer_alive: true, dirty: true }));

  expect(verdict).toEqual({ state: "cleanup_required", blocker: "writer_alive" });
});

it("blocks a dirty worktree", () => {
  expect(projectWorkspaceState(facts({ dirty: true }))).toEqual({
    state: "cleanup_required",
    blocker: "worktree_dirty",
  });
});

it("blocks a worktree git could not read at all", () => {
  expect(projectWorkspaceState(facts({ dirty: null }))).toEqual({
    state: "cleanup_required",
    blocker: "worktree_unreadable",
  });
});

it("blocks while no merged pull request stands for the branch", () => {
  expect(projectWorkspaceState(facts({ pull_request_merged: false }))).toEqual({
    state: "cleanup_required",
    blocker: "pull_request_not_merged",
  });
});

it("reads a registration with no directory as stale, and a bare record as missing", () => {
  expect(projectWorkspaceState(facts({ present: false }))).toEqual({
    state: "stale",
    blocker: null,
  });
  expect(projectWorkspaceState(facts({ present: false, registered: false }))).toEqual({
    state: "missing",
    blocker: null,
  });
});

it("never manages a worktree it could not attach, however clean it looks", () => {
  for (const attachment of ["none", "ambiguous"] as const) {
    expect(projectWorkspaceState(facts({ attachment }))).toEqual({
      state: "unmanaged",
      blocker: "unmanaged_worktree",
    });
  }
});

it("reads an archived or removed record as already cleaned", () => {
  for (const record_status of ["archived", "removed"] as const) {
    expect(projectWorkspaceState(facts({ record_status }))).toEqual({
      state: "removed",
      blocker: null,
    });
  }
});

it("says why an ambiguous worktree was left alone rather than repeating the unmanaged sentence", () => {
  const ambiguous = describeWorkspace(
    { state: "unmanaged", blocker: "unmanaged_worktree" },
    "ambiguous",
  );
  const external = describeWorkspace({ state: "unmanaged", blocker: "unmanaged_worktree" }, "none");

  expect(ambiguous).not.toEqual(external);
  expect(ambiguous).toContain("no record claims it");
});
