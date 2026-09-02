import { DEFAULT_WORKSPACES_FILTER, filterWorkspaces } from "@web/lib/workspace/filter";
import type { WorkspaceRow } from "@web/lib/workspace/row";
import { expect, it } from "vitest";

import { workspaceEntry } from "#support/workspace";

const LOCAL = { id: "local", label: "Local", kind: "local" } as const;
const REMOTE = { id: "remote", label: "otomat-vps", kind: "ssh" } as const;

function entry(over: Partial<WorkspaceRow> & { id: string }): WorkspaceRow {
  return { host: LOCAL, ...workspaceEntry({ id: over.id }), ...over };
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

it("searches the owning host, so its label narrows to that host's rows alone", () => {
  const rows = [entry({ id: "a" }), entry({ id: "a", host: REMOTE })];

  expect(
    filterWorkspaces(rows, { search: "otomat-vps", states: [] }).map((row) => row.host.id),
  ).toEqual(["remote"]);
});
