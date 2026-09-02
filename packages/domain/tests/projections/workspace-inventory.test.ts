import { expect, it } from "vitest";

import {
  describeWorkspace,
  isWorkspaceAutoDeletable,
  isWorkspaceCleanable,
  projectWorkspaceState,
  type WorkspaceFacts,
} from "#domain/projections/workspace-inventory";

const PR = { number: 7, url: null, merged: true };

/** A quiet, clean workspace whose cycle is closed: the only shape a deletion is allowed to act on. */
function facts(over: Partial<WorkspaceFacts> = {}): WorkspaceFacts {
  return {
    attachment: "record",
    registered: true,
    present: true,
    record_status: "active",
    cycle_open: false,
    dirty: false,
    writer_alive: false,
    ...over,
  };
}

it("clears a closed cycle whose worktree is quiet and clean", () => {
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

it("leaves a closed cycle deletable by hand, and automatic only once a merge stands", () => {
  const closed = projectWorkspaceState(facts());

  expect(isWorkspaceCleanable(closed)).toBe(true);
  expect(isWorkspaceAutoDeletable({ ...closed, pull_request: null })).toBe(false);
  expect(isWorkspaceAutoDeletable({ ...closed, pull_request: { ...PR, merged: false } })).toBe(
    false,
  );
  expect(isWorkspaceAutoDeletable({ ...closed, pull_request: PR })).toBe(true);
  expect(
    isWorkspaceAutoDeletable({
      ...projectWorkspaceState(facts({ dirty: true })),
      pull_request: PR,
    }),
  ).toBe(false);
});

it("refuses every deletion an operator could regret", () => {
  const refused = [facts({ cycle_open: true }), facts({ dirty: true }), facts({ dirty: null })];

  expect(refused.map((fact) => isWorkspaceCleanable(projectWorkspaceState(fact)))).toEqual([
    false,
    false,
    false,
  ]);
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
