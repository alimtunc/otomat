import {
  placedBefore,
  readStoredProjectLayout,
  withGroup,
  withGroupMoved,
  withGroupName,
  withGroupToggled,
  withoutGroup,
  withProjectIcon,
  withSectionOrder,
  writeStoredProjectLayout,
  type ProjectLayout,
} from "@web/components/shell/project-layout/layout";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

const LAYOUT: ProjectLayout = {
  ungrouped: ["local:a", "local:b"],
  groups: [
    { id: "crm", name: "CRM", collapsed: false, projects: ["local:c", "local:d"] },
    { id: "vps", name: "VPS", collapsed: true, projects: ["vps-1:e"] },
  ],
  icons: { "local:a": "rocket" },
};

function groupProjects(layout: ProjectLayout): Record<string, string[]> {
  return Object.fromEntries([
    ["ungrouped", layout.ungrouped],
    ...layout.groups.map((group) => [group.id, group.projects]),
  ]);
}

describe("project layout persistence", () => {
  it("reads back what it wrote", () => {
    const storage = memoryStorage();
    writeStoredProjectLayout(LAYOUT, storage);

    expect(readStoredProjectLayout(storage)).toEqual(LAYOUT);
  });

  it("starts empty without a stored layout or with an unreadable one", () => {
    const storage = memoryStorage();
    expect(readStoredProjectLayout(storage)).toEqual({ ungrouped: [], groups: [], icons: {} });

    storage.setItem("otomat.project-layout", "{not json");
    expect(readStoredProjectLayout(storage)).toEqual({ ungrouped: [], groups: [], icons: {} });
  });

  it("keeps a project in one place and drops what it cannot trust", () => {
    const storage = memoryStorage();
    storage.setItem(
      "otomat.project-layout",
      JSON.stringify({
        ungrouped: ["local:a", 7, "local:a"],
        groups: [
          { id: "crm", name: "CRM", projects: ["local:a", "local:c"] },
          { id: "crm", name: "Duplicate", projects: ["local:d"] },
          { id: "blank", name: "  ", projects: [] },
          "not a group",
        ],
        icons: { "local:a": "rocket", "local:c": "not-an-icon" },
      }),
    );

    expect(readStoredProjectLayout(storage)).toEqual({
      ungrouped: ["local:a"],
      groups: [{ id: "crm", name: "CRM", collapsed: false, projects: ["local:c"] }],
      icons: { "local:a": "rocket" },
    });
  });
});

describe("project placement", () => {
  it("inserts a project before another, or last without one", () => {
    expect(placedBefore(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(placedBefore(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(placedBefore(["a", "b"], "x", "b")).toEqual(["a", "x", "b"]);
    expect(placedBefore(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });

  it("reorders a section and moves a project across sections without duplicating it", () => {
    const reordered = withSectionOrder(LAYOUT, "crm", ["local:d", "local:c"]);
    expect(groupProjects(reordered)["crm"]).toEqual(["local:d", "local:c"]);

    const moved = withSectionOrder(LAYOUT, "vps", ["vps-1:e", "local:a"]);
    expect(groupProjects(moved)).toEqual({
      ungrouped: ["local:b"],
      crm: ["local:c", "local:d"],
      vps: ["vps-1:e", "local:a"],
    });
  });

  it("keeps a project the catalog does not list right now behind the listed ones", () => {
    const layout = withSectionOrder(LAYOUT, "crm", ["local:d"]);

    expect(groupProjects(layout)["crm"]).toEqual(["local:d", "local:c"]);
  });

  it("places a project the layout never held, and ignores a group that no longer exists", () => {
    expect(withSectionOrder(LAYOUT, null, ["local:new", "local:a", "local:b"]).ungrouped).toEqual([
      "local:new",
      "local:a",
      "local:b",
    ]);
    expect(withSectionOrder(LAYOUT, "gone", ["local:a"])).toBe(LAYOUT);
  });
});

describe("project groups", () => {
  it("creates, renames and folds a group", () => {
    const created = withGroup(LAYOUT, "ops", "Ops");
    expect(created.groups.at(-1)).toEqual({
      id: "ops",
      name: "Ops",
      collapsed: false,
      projects: [],
    });

    const renamed = withGroupName(created, "ops", "Operations");
    expect(renamed.groups.at(-1)?.name).toBe("Operations");

    expect(withGroupToggled(renamed, "ops").groups.at(-1)?.collapsed).toBe(true);
    expect(withGroupToggled(LAYOUT, "vps").groups[1]?.collapsed).toBe(false);
  });

  it("reorders groups and stops at the edges", () => {
    expect(withGroupMoved(LAYOUT, "vps", -1).groups.map((group) => group.id)).toEqual([
      "vps",
      "crm",
    ]);
    expect(withGroupMoved(LAYOUT, "crm", -1)).toBe(LAYOUT);
    expect(withGroupMoved(LAYOUT, "vps", 1)).toBe(LAYOUT);
  });

  it("deletes a group without losing its projects", () => {
    const layout = withoutGroup(LAYOUT, "crm");

    expect(layout.groups.map((group) => group.id)).toEqual(["vps"]);
    expect(layout.ungrouped).toEqual(["local:a", "local:b", "local:c", "local:d"]);
  });
});

describe("project icons", () => {
  it("sets an icon and resets it to the default", () => {
    const chosen = withProjectIcon(LAYOUT, "local:b", "server");
    expect(chosen.icons).toEqual({ "local:a": "rocket", "local:b": "server" });

    expect(withProjectIcon(chosen, "local:a", null).icons).toEqual({ "local:b": "server" });
  });
});
