// @vitest-environment happy-dom
import { readSelectedProjectId } from "@web/components/shell/project-selection";
import { projectSelectionStore } from "@web/components/shell/project-selection-store";
import { describe, expect, it } from "vitest";

describe("project selection store", () => {
  it("select notifies subscribers and persists for the next session", () => {
    const seen: Array<string | undefined> = [];
    const subscription = projectSelectionStore.subscribe((value) => seen.push(value));

    projectSelectionStore.actions.select("other");

    expect(projectSelectionStore.state).toBe("other");
    expect(seen).toContain("other");
    expect(readSelectedProjectId()).toBe("other");
    subscription.unsubscribe();
  });
});
