// @vitest-environment happy-dom
import { DeskTabsBar } from "@web/components/shell/project-desk/bar";
import { projectDeskStore, getProjectDesk } from "@web/components/shell/project-desk/store";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { CONTEXT_NAVIGATION_EVENT } from "@web/lib/context-navigation";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { findLabelled, findMenuItem } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
let mounted: Mounted | undefined;
stubAnimations();
beforeEach(() => {
  navigate.mockReset();
  projectDeskStore.setState(() => ({ desks: {}, pending: null }));
  projectTabsStore.setState(() => []);
});
afterEach(async () => {
  await mounted?.cleanup();
  document.body.replaceChildren();
  localStorage.clear();
});
function cancelNavigation(event: Event): void {
  event.preventDefault();
}
async function chooseFiles() {
  await act(async () => findLabelled("New tab")?.click());
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const files = findMenuItem("Files");
  expect(files).toBeDefined();
  await act(async () => files?.click());
}
it("creates a view only after an explicit selection in the New tab dropdown", async () => {
  mounted = await mount(<DeskTabsBar projectKey="local:p" />);
  expect(document.querySelectorAll("[data-desk-tab]")).toHaveLength(1);
  await chooseFiles();
  expect(getProjectDesk("local:p").tabs).toHaveLength(2);
  expect(navigate).toHaveBeenCalledWith({ href: "/files" });
});
it("does not change tabs or navigate when an editor refuses to leave", async () => {
  mounted = await mount(<DeskTabsBar projectKey="local:p" />);
  window.addEventListener(CONTEXT_NAVIGATION_EVENT, cancelNavigation);
  try {
    await chooseFiles();
    expect(getProjectDesk("local:p").tabs).toHaveLength(1);
    expect(projectDeskStore.state.pending).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener(CONTEXT_NAVIGATION_EVENT, cancelNavigation);
  }
});
