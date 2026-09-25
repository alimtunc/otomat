import { arrangeProjects, switcherSections } from "@web/components/shell/project-layout/arrange";
import type { ProjectLayout } from "@web/components/shell/project-layout/layout";
import { describe, expect, it } from "vitest";

const LAYOUT: ProjectLayout = {
  ungrouped: ["local:b"],
  groups: [
    { id: "crm", name: "CRM", collapsed: false, projects: ["local:c", "vps-1:gone", "local:a"] },
    { id: "empty", name: "Empty", collapsed: false, projects: [] },
  ],
  icons: { "local:c": "briefcase" },
};

function ids(sections: { items: { id: string }[] }[]): string[][] {
  return sections.map((section) => section.items.map((item) => item.id));
}

describe("arranged projects", () => {
  it("keeps the catalog order when nothing was organized", () => {
    const empty: ProjectLayout = { ungrouped: [], groups: [], icons: {} };

    expect(ids(arrangeProjects(empty, [{ id: "local:b" }, { id: "local:a" }]))).toEqual([
      ["local:b", "local:a"],
    ]);
  });

  it("follows the operator's order and groups", () => {
    const sections = arrangeProjects(LAYOUT, [
      { id: "local:a" },
      { id: "local:b" },
      { id: "local:c" },
    ]);

    expect(sections.map((section) => section.group?.name ?? null)).toEqual([null, "CRM", "Empty"]);
    expect(ids(sections)).toEqual([["local:b"], ["local:c", "local:a"], []]);
  });

  it("appends a newly added project to the ungrouped section", () => {
    const sections = arrangeProjects(LAYOUT, [
      { id: "local:new" },
      { id: "local:a" },
      { id: "local:b" },
      { id: "local:c" },
    ]);

    expect(ids(sections)[0]).toEqual(["local:b", "local:new"]);
  });

  it("skips a project the catalog no longer lists and brings it back in place when it returns", () => {
    const withoutHost = arrangeProjects(LAYOUT, [{ id: "local:a" }, { id: "local:c" }]);
    expect(ids(withoutHost)[1]).toEqual(["local:c", "local:a"]);

    const hostBack = arrangeProjects(LAYOUT, [
      { id: "local:a" },
      { id: "local:c" },
      { id: "vps-1:gone" },
    ]);
    expect(ids(hostBack)[1]).toEqual(["local:c", "vps-1:gone", "local:a"]);
  });

  it("shows a project under the name the catalog gives it now", () => {
    const [ungrouped] = arrangeProjects(LAYOUT, [{ id: "local:b", name: "Renamed" }]);

    expect(ungrouped?.items).toEqual([{ id: "local:b", name: "Renamed" }]);
  });

  it("labels the switcher's groups and applies the chosen icons", () => {
    const sections = switcherSections(LAYOUT, [
      { id: "local:a", name: "A" },
      { id: "local:c", name: "C", tag: "Local" },
    ]);

    expect(sections).toEqual([
      { id: "ungrouped", label: undefined, items: [] },
      {
        id: "crm",
        label: "CRM",
        items: [
          { id: "local:c", name: "C", tag: "Local", icon: "briefcase" },
          { id: "local:a", name: "A", icon: undefined },
        ],
      },
      { id: "empty", label: "Empty", items: [] },
    ]);
  });
});
