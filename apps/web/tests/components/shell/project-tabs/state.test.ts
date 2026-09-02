import {
  openTabHosts,
  projectTabDestination,
  readStoredProjectTabs,
  withoutProjectTab,
  withProjectTab,
  withProjectTabRoute,
  writeStoredProjectTabs,
} from "@web/components/shell/project-tabs/state";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

const LOCAL = "local:project-1";
const REMOTE = "remote:project-1";

describe("stored project tabs", () => {
  it("keeps one tab per project however often it is opened", () => {
    const tabs = withProjectTab(withProjectTab(withProjectTab([], LOCAL), REMOTE), LOCAL);

    expect(tabs.map((tab) => tab.key)).toEqual([LOCAL, REMOTE]);
  });

  it("tells the same host's project from another host's", () => {
    const tabs = withProjectTabRoute(
      withProjectTab(withProjectTab([], LOCAL), REMOTE),
      REMOTE,
      "/runs",
    );

    expect(tabs).toEqual([
      { key: LOCAL, route: null },
      { key: REMOTE, route: "/runs" },
    ]);
  });

  it("records a route only for a tab the operator opened", () => {
    const tabs = withProjectTab([], REMOTE);

    expect(withProjectTabRoute(tabs, LOCAL, "/runs")).toBe(tabs);
    expect(withProjectTabRoute([], LOCAL, "/runs")).toEqual([]);
  });

  it("restores the order, the tabs and each last route after a restart", () => {
    const storage = memoryStorage();
    const opened = withProjectTabRoute(
      withProjectTab(withProjectTab([], LOCAL), "local:project-2"),
      LOCAL,
      "/issues/issue-7",
    );
    writeStoredProjectTabs(opened, storage);

    expect(readStoredProjectTabs(storage)).toEqual([
      { key: LOCAL, route: "/issues/issue-7" },
      { key: "local:project-2", route: null },
    ]);
  });

  it("reads no tab out of an unusable payload", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.project-tabs", "{oops");

    expect(readStoredProjectTabs(storage)).toEqual([]);
    expect(readStoredProjectTabs(memoryStorage())).toEqual([]);
  });

  it("drops the duplicates and the unusable entries a stored payload carries", () => {
    const storage = memoryStorage();
    storage.setItem(
      "otomat.project-tabs",
      JSON.stringify([
        { key: LOCAL, route: "/runs" },
        { key: LOCAL, route: "/issues" },
        { route: "/issues" },
        { key: REMOTE, route: 7 },
      ]),
    );

    expect(readStoredProjectTabs(storage)).toEqual([
      { key: LOCAL, route: "/runs" },
      { key: REMOTE, route: null },
    ]);
  });

  it("forgets the route of a closed tab, and leaves the other tabs alone", () => {
    const tabs = withProjectTabRoute(
      withProjectTab(withProjectTab([], REMOTE), LOCAL),
      LOCAL,
      "/issues/issue-7",
    );

    expect(withoutProjectTab(tabs, LOCAL)).toEqual([{ key: REMOTE, route: null }]);
    expect(withProjectTab(withoutProjectTab(tabs, LOCAL), LOCAL).at(-1)).toEqual({
      key: LOCAL,
      route: null,
    });
  });

  it("returns the same list when nothing changed", () => {
    const tabs = withProjectTabRoute(withProjectTab([], LOCAL), LOCAL, "/issues");

    expect(withProjectTab(tabs, LOCAL)).toBe(tabs);
    expect(withProjectTabRoute(tabs, LOCAL, "/issues")).toBe(tabs);
    expect(withoutProjectTab(tabs, REMOTE)).toBe(tabs);
  });
});

describe("project tab destination", () => {
  it("restores the view the project was left on", () => {
    const tabs = withProjectTabRoute(withProjectTab([], LOCAL), LOCAL, "/runs/run-3/diff");

    expect(projectTabDestination(tabs, LOCAL, "/issues/issue-7")).toBe("/runs/run-3/diff");
  });

  it("leaves a detail view behind when the activated tab has no route yet", () => {
    expect(projectTabDestination([], LOCAL, "/issues/issue-7")).toBe("/issues");
    expect(projectTabDestination([], LOCAL, "/runs/run-3")).toBe("/issues");
    expect(projectTabDestination([], LOCAL, "/pull-requests/pr-1")).toBe("/issues");
  });

  it("stays on a list view when the activated tab has no route yet", () => {
    expect(projectTabDestination([], LOCAL, "/issues")).toBeNull();
    expect(projectTabDestination([], LOCAL, "/settings/project")).toBeNull();
  });
});

describe("open tab hosts", () => {
  it("names the active host once, then every host with an open tab", () => {
    expect(openTabHosts([{ key: REMOTE, route: null }], "local")).toEqual(["local", "remote"]);
    expect(openTabHosts([{ key: LOCAL, route: null }], "local")).toEqual(["local"]);
    expect(openTabHosts([], "remote")).toEqual(["remote"]);
  });
});
