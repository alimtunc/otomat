import { visibleProjectTabs } from "@web/components/shell/project-tabs/visible-tabs";
import { describe, expect, it } from "vitest";

const PROJECTS = [
  { id: "local:project-1", name: "Otomat" },
  { id: "local:project-2", name: "Cockpit" },
  { id: "remote:project-3", name: "Daemon", tag: "vps" },
];

function tabs(
  stored: string[],
  activeKey: string | undefined,
  attention: Map<string, number> = new Map(),
) {
  return visibleProjectTabs({
    stored: stored.map((key) => ({ key, route: null })),
    projects: PROJECTS,
    activeKey,
    attention,
  });
}

describe("visible project tabs", () => {
  it("gives the active project a tab even before one was persisted", () => {
    expect(tabs([], "local:project-1")).toEqual([{ id: "local:project-1", name: "Otomat" }]);
  });

  it("keeps one tab per project, in the order they were opened", () => {
    const opened = tabs(["local:project-2", "local:project-1"], "local:project-1");

    expect(opened.map((tab) => tab.id)).toEqual(["local:project-2", "local:project-1"]);
  });

  it("drops a tab whose project the connected daemon no longer lists", () => {
    expect(tabs(["local:gone", "local:project-1"], "local:project-1").map((tab) => tab.id)).toEqual(
      ["local:project-1"],
    );
  });

  it("carries each project's own attention count and the host it runs on", () => {
    const counted = tabs(
      ["local:project-1", "local:project-2", "remote:project-3"],
      "local:project-2",
      new Map([
        ["local:project-1", 3],
        ["local:project-2", 0],
      ]),
    );

    expect(counted).toEqual([
      { id: "local:project-1", name: "Otomat", attention: 3 },
      { id: "local:project-2", name: "Cockpit", attention: 0 },
      { id: "remote:project-3", name: "Daemon", tag: "vps" },
    ]);
  });

  it("renders no tab while no project is selected and none was persisted", () => {
    expect(tabs([], undefined)).toEqual([]);
  });
});
