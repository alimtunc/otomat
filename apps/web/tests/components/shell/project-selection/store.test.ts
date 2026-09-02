// @vitest-environment happy-dom
import {
  readSelectedProjectIds,
  type SelectedProjectIds,
} from "@web/components/shell/project-selection/selection";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { describe, expect, it } from "vitest";

describe("project selection store", () => {
  it("keeps one project per host, notifies subscribers and persists for the next session", () => {
    const seen: SelectedProjectIds[] = [];
    const subscription = projectSelectionStore.subscribe(() =>
      seen.push(projectSelectionStore.state),
    );

    projectSelectionStore.actions.select("local", "other");
    projectSelectionStore.actions.select("remote", "far");

    const expected = new Map([
      ["local", "other"],
      ["remote", "far"],
    ]);
    expect(projectSelectionStore.state).toEqual(expected);
    expect(seen.at(-1)).toEqual(expected);
    expect(readSelectedProjectIds()).toEqual(expected);
    subscription.unsubscribe();
  });
});
