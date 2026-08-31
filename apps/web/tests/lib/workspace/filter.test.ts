import {
  DEFAULT_WORKSPACES_FILTER,
  filterWorkspaces,
  groupWorkspacesByRepository,
} from "@web/lib/workspace/filter";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { expect, it } from "vitest";

const LOCAL = { id: "local", label: "Local", kind: "local" } as const;
const REMOTE = { id: "remote", label: "otomat-vps", kind: "ssh" } as const;

function entry(over: Partial<WorkspaceRow> & { id: string }): WorkspaceRow {
  return {
    host: LOCAL,
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
    reason: "Ready to delete.",
    registered: true,
    present: true,
    dirty: false,
    head_sha: null,
    last_activity_at: null,
    pull_request: null,
    ...over,
  };
}

it("hides already cleaned workspaces until a state is asked for by name", () => {
  const entries = [entry({ id: "a" }), entry({ id: "b", state: "removed" })];

  expect(filterWorkspaces(entries, DEFAULT_WORKSPACES_FILTER).map((row) => row.id)).toEqual(["a"]);
  expect(
    filterWorkspaces(entries, { search: "", states: ["removed"] }).map((row) => row.id),
  ).toEqual(["b"]);
});

it("searches the issue, the branch, the path and the repository alike", () => {
  const entries = [
    entry({ id: "a", branch: "otomat/run/alpha" }),
    entry({ id: "b", issue_identifier: "OTO-12", issue_title: "Something else" }),
  ];

  expect(filterWorkspaces(entries, { search: "ALPHA", states: [] }).map((row) => row.id)).toEqual([
    "a",
  ]);
  expect(filterWorkspaces(entries, { search: "oto-12", states: [] }).map((row) => row.id)).toEqual([
    "b",
  ]);
  expect(filterWorkspaces(entries, { search: "otomat", states: [] })).toHaveLength(2);
});

it("keeps an unmanaged worktree searchable even though it names no issue", () => {
  const external = entry({
    id: "x",
    issue_id: null,
    issue_identifier: null,
    issue_title: null,
    branch: "by-hand",
    state: "unmanaged",
  });

  expect(filterWorkspaces([external], { search: "by-hand", states: [] })).toHaveLength(1);
});

it("groups by repository, keeping every entry under the checkout it belongs to", () => {
  const groups = groupWorkspacesByRepository([
    entry({ id: "a" }),
    entry({ id: "b", repository_id: "repo-2", repository_name: "other" }),
    entry({ id: "c" }),
  ]);

  expect(groups.map((group) => group.name)).toEqual(["otomat", "other"]);
  expect(groups[0].rows.map((row) => row.id)).toEqual(["a", "c"]);
});

it("searches the owning host, so its label narrows to that host's rows alone", () => {
  const rows = [entry({ id: "a" }), entry({ id: "a", host: REMOTE })];

  expect(
    filterWorkspaces(rows, { search: "otomat-vps", states: [] }).map((row) => row.host.id),
  ).toEqual(["remote"]);
});
