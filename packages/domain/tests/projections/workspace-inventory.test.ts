import { expect, it } from "vitest";

import {
  describeWorkspace,
  isWorkspaceAutoDeletable,
  isWorkspaceCleanable,
  isWorkspaceForceCleanable,
  projectWorkspaceProvenance,
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
    uncommitted_files: 0,
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
  const verdict = projectWorkspaceState(facts({ writer_alive: true, uncommitted_files: 3 }));

  expect(verdict).toEqual({ state: "cleanup_required", blocker: "writer_alive" });
});

it("blocks a dirty worktree", () => {
  expect(projectWorkspaceState(facts({ uncommitted_files: 1 }))).toEqual({
    state: "cleanup_required",
    blocker: "worktree_dirty",
  });
});

it("blocks a worktree git could not read at all", () => {
  expect(projectWorkspaceState(facts({ uncommitted_files: null }))).toEqual({
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
      ...projectWorkspaceState(facts({ uncommitted_files: 1 })),
      pull_request: PR,
    }),
  ).toBe(false);
});

it("refuses every deletion an operator could regret", () => {
  const refused = [
    facts({ cycle_open: true }),
    facts({ uncommitted_files: 1 }),
    facts({ uncommitted_files: null }),
  ];

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

it("never touches a worktree outside the root, and offers the unreconciled one a clean deletion", () => {
  const external = projectWorkspaceState(facts({ attachment: "none" }));
  const unreconciled = projectWorkspaceState(facts({ attachment: "ambiguous" }));

  expect(external).toEqual({ state: "unmanaged", blocker: "unmanaged_worktree" });
  expect(isWorkspaceCleanable(external)).toBe(false);
  expect(isWorkspaceForceCleanable(external)).toBe(false);
  expect(unreconciled).toEqual({ state: "unmanaged", blocker: null });
  expect(isWorkspaceCleanable(unreconciled)).toBe(true);
});

it("holds an unreconciled worktree to the same work-on-disk refusals as a recorded one", async () => {
  const dirty = projectWorkspaceState(facts({ attachment: "ambiguous", uncommitted_files: 1 }));

  expect(dirty).toEqual({ state: "unmanaged", blocker: "worktree_dirty" });
  expect(isWorkspaceCleanable(dirty)).toBe(false);
  expect(isWorkspaceForceCleanable(dirty)).toBe(true);
});

it("forces only over the work left on disk, never over a live writer or an open cycle", () => {
  const forceable = [
    facts({ uncommitted_files: 2 }),
    facts({ uncommitted_files: null }),
    facts({ present: false }),
    facts({ present: false, registered: false }),
  ];
  const never = [
    facts({ cycle_open: true }),
    facts({ writer_alive: true }),
    facts({ present: false, writer_alive: true }),
  ];

  expect(forceable.map((fact) => isWorkspaceForceCleanable(projectWorkspaceState(fact)))).toEqual([
    true,
    true,
    true,
    true,
  ]);
  expect(never.map((fact) => isWorkspaceForceCleanable(projectWorkspaceState(fact)))).toEqual([
    false,
    false,
    false,
  ]);
});

it("names where every row came from, including the one git no longer registers", () => {
  const cases: Array<[Partial<WorkspaceFacts>, string]> = [
    [{}, "otomat_run"],
    [{ attachment: "none" }, "external_worktree"],
    [{ attachment: "ambiguous" }, "otomat_unreconciled"],
    [{ present: false }, "missing_path"],
    [{ present: false, registered: false }, "orphan_record"],
    [{ registered: false }, "unknown"],
  ];

  expect(cases.map(([over]) => projectWorkspaceProvenance(facts(over)))).toEqual(
    cases.map(([, expected]) => expected),
  );
});

it("reads an archived or removed record as already cleaned", () => {
  for (const record_status of ["archived", "removed"] as const) {
    expect(projectWorkspaceState(facts({ record_status }))).toEqual({
      state: "removed",
      blocker: null,
    });
  }
});

it("explains an unmanaged row by where it came from, not by one sentence for both", () => {
  const unreconciled = describeWorkspace(
    { state: "unmanaged", blocker: null },
    "otomat_unreconciled",
  );
  const external = describeWorkspace(
    { state: "unmanaged", blocker: "unmanaged_worktree" },
    "external_worktree",
  );

  expect(unreconciled).not.toEqual(external);
  expect(unreconciled).toContain("no record claims");
  expect(external).toContain("worktrees root");
});
