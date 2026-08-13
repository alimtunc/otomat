import {
  addView,
  emptyViewSet,
  findView,
  moveView,
  orderedViews,
  parseViewSet,
  removeView,
  renameView,
  selectView,
  storeViewConfig,
  type SavedView,
  type ViewSet,
} from "@web/lib/issue/saved-view";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { describe, expect, it } from "vitest";

const SYSTEM: SavedView = { id: "all", name: "All", config: DEFAULT_ISSUES_VIEW_CONFIG };

function sortedBy(sort: IssuesViewConfig["sort"]): IssuesViewConfig {
  return { ...DEFAULT_ISSUES_VIEW_CONFIG, sort };
}

function withSaved(...names: string[]): ViewSet {
  return names.reduce(
    (set, name) => addView(set, { id: name, name, config: DEFAULT_ISSUES_VIEW_CONFIG }),
    emptyViewSet(SYSTEM),
  );
}

describe("view set", () => {
  it("starts on the system view alone", () => {
    const set = emptyViewSet(SYSTEM);
    expect(orderedViews(set)).toEqual([SYSTEM]);
    expect(findView(set, set.activeId)).toEqual(SYSTEM);
  });

  it("keeps the system view first and activates what it adds", () => {
    const set = withSaved("mine", "review");
    expect(orderedViews(set).map((view) => view.id)).toEqual(["all", "mine", "review"]);
    expect(set.activeId).toBe("review");
  });

  it("falls back to the system view for an id it does not know", () => {
    const set = withSaved("mine");
    expect(findView(set, "gone").id).toBe("all");
    expect(findView(set, undefined).id).toBe("all");
    expect(selectView(set, "gone").activeId).toBe("all");
  });

  it("renames and stores a configuration on a saved view only", () => {
    const set = renameView(
      storeViewConfig(withSaved("mine"), "mine", sortedBy("title")),
      "mine",
      "Mine",
    );
    expect(set.saved[0]).toEqual({ id: "mine", name: "Mine", config: sortedBy("title") });
    expect(renameView(set, "all", "Everything").system).toEqual(SYSTEM);
    expect(storeViewConfig(set, "all", sortedBy("title")).system).toEqual(SYSTEM);
  });

  it("returns to the system view when the active one is deleted", () => {
    const set = removeView(withSaved("mine", "review"), "review");
    expect(set.saved.map((view) => view.id)).toEqual(["mine"]);
    expect(set.activeId).toBe("all");
  });

  it("cannot delete the system view", () => {
    expect(removeView(withSaved("mine"), "all").system).toEqual(SYSTEM);
  });

  it("reorders saved views and stops at the edges", () => {
    const set = withSaved("a", "b", "c");
    expect(moveView(set, "c", -1).saved.map((view) => view.id)).toEqual(["a", "c", "b"]);
    expect(moveView(set, "a", -1).saved.map((view) => view.id)).toEqual(["a", "b", "c"]);
    expect(moveView(set, "c", 1).saved.map((view) => view.id)).toEqual(["a", "b", "c"]);
  });
});

describe("parseViewSet", () => {
  it("reads back what a set wrote", () => {
    const set = withSaved("mine");
    expect(parseViewSet({ saved: set.saved, activeId: "mine" }, SYSTEM)).toEqual(set);
  });

  it("returns the system view alone for anything unreadable", () => {
    expect(parseViewSet(null, SYSTEM)).toEqual(emptyViewSet(SYSTEM));
    expect(parseViewSet({ saved: "mine" }, SYSTEM)).toEqual(emptyViewSet(SYSTEM));
  });

  it("drops nameless, duplicated and system-shadowing entries", () => {
    const set = parseViewSet(
      {
        saved: [
          { id: "mine", name: "Mine", config: { sort: "title" } },
          { id: "mine", name: "Twin", config: {} },
          { id: "all", name: "Shadow", config: {} },
          { id: "blank", name: "  ", config: {} },
          "nonsense",
        ],
        activeId: "mine",
      },
      SYSTEM,
    );
    expect(set.saved.map((view) => view.name)).toEqual(["Mine"]);
    expect(set.saved[0]?.config).toEqual(sortedBy("title"));
    expect(set.activeId).toBe("mine");
  });

  it("falls back to the system view when the stored active view is gone", () => {
    expect(parseViewSet({ saved: [], activeId: "mine" }, SYSTEM).activeId).toBe("all");
  });
});
