import {
  activateDeskTab,
  addDeskTab,
  closeDeskTab,
  initialProjectDesk,
  isDeskRoute,
  moveDeskTab,
  navigateDesk,
  readProjectDesks,
} from "@web/components/shell/project-desk/state";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("Project desk navigation", () => {
  it("replaces the active view, including query and hash, without adding tabs", () => {
    let desk = initialProjectDesk("/issues?view=board");
    for (const href of [
      "/runs",
      "/runs/r1/diff?step=s1#file",
      "/conversations?run=r1&step=s1",
      "/conversations?terminal=t1",
      "/terminal",
      "/files",
    ]) {
      desk = navigateDesk(desk, { href, label: href });
      expect(desk.tabs).toHaveLength(1);
      expect(desk.page.href).toBe(href);
    }
  });
  it("creates duplicate views only explicitly, reorders them and chooses a neighbor on close", () => {
    let desk = addDeskTab(initialProjectDesk(), "files-1", {
      href: "/files?path=one",
      label: "Files",
    });
    desk = addDeskTab(desk, "files-2", { href: "/files?path=two", label: "Files" });
    desk = moveDeskTab(desk, "files-2", -1);
    expect(desk.tabs.map((tab) => tab.id)).toEqual(["initial", "files-2", "files-1"]);
    desk = activateDeskTab(desk, "initial");
    expect(desk.page).toEqual({ href: "/project", label: "Project" });
    expect(activateDeskTab(desk, "missing")).toBe(desk);
    desk = closeDeskTab(desk, "files-2");
    expect(desk.active).toBe("initial");
    desk = closeDeskTab(desk, "initial");
    expect(desk.page.href).toBe("/files?path=one");
  });
  it("does not recreate a closed last tab when navigating", () => {
    const empty = closeDeskTab(initialProjectDesk(), "initial");
    const navigated = navigateDesk(empty, { href: "/issues", label: "Issues" });
    expect(navigated.tabs).toEqual([]);
    expect(navigated.active).toBeNull();
    expect(navigated.page.href).toBe("/issues");
  });
  it("restores independent local and remote projects, including explicitly empty desks", () => {
    const storage = memoryStorage();
    const desks = {
      "local:same": initialProjectDesk("/files"),
      "remote:same": closeDeskTab(initialProjectDesk(), "initial"),
    };
    storage.setItem("otomat.project-desks", JSON.stringify(desks));
    expect(readProjectDesks(storage)).toEqual(desks);
  });
  it("rejects external and global locations in stored tabs", () => {
    for (const href of [
      "https://outside.test",
      "//outside.test/files",
      "/inbox",
      "/conversations",
      "javascript:alert(1)",
    ])
      expect(isDeskRoute(href)).toBe(false);
    const storage = memoryStorage();
    storage.setItem(
      "otomat.project-desks",
      JSON.stringify({
        "local:p": {
          page: { href: "/project", label: "Project" },
          active: "bad",
          tabs: [{ id: "bad", href: "//outside.test/files", label: "Bad" }],
        },
      }),
    );
    expect(readProjectDesks(storage)["local:p"]?.tabs).toEqual([]);
  });
  it("keeps only host-qualified desks", () => {
    const storage = memoryStorage();
    const desk = initialProjectDesk();
    storage.setItem(
      "otomat.project-desks",
      JSON.stringify({ "local:p": desk, locals: desk, "p:local": desk, "remote:": desk }),
    );
    expect(Object.keys(readProjectDesks(storage))).toEqual(["local:p"]);
  });
});
