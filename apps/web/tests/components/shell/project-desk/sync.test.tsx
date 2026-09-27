// @vitest-environment happy-dom
import { addDeskTab } from "@web/components/shell/project-desk/state";
import { projectDeskStore, getProjectDesk } from "@web/components/shell/project-desk/store";
import { useDeskSync } from "@web/components/shell/project-desk/use-sync";
import { projectSelectionStore } from "@web/components/shell/project-selection/store";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const route = {
  key: "local:p",
  projectId: "p",
  host: "local",
  href: "/files",
  label: "Files",
  scoped: true,
};
vi.mock("@web/components/shell/project-desk/use-route", () => ({ useDeskRoute: () => route }));
let mounted: Mounted | undefined;
function Probe() {
  useDeskSync();
  return null;
}
beforeEach(() => {
  projectDeskStore.setState(() => ({ desks: {}, pending: null }));
  projectTabsStore.setState(() => []);
  projectSelectionStore.setState(() => new Map());
  route.key = "local:p";
  route.projectId = "p";
  route.href = "/files";
  route.scoped = true;
});
afterEach(async () => {
  await mounted?.cleanup();
  localStorage.clear();
});
it("clears a same-location tab intent so the next ordinary navigation is recorded", async () => {
  mounted = await mount(<Probe />);
  await act(async () => {
    projectDeskStore.actions.edit("local:p", (desk) =>
      addDeskTab(desk, "duplicate", { href: "/files", label: "Files" }),
    );
    projectDeskStore.actions.expect("local:p", "/files");
  });
  expect(projectDeskStore.state.pending).toBeNull();
  route.href = "/issues";
  await mounted.rerender(<Probe />);
  expect(getProjectDesk("local:p").tabs).toHaveLength(2);
  expect(getProjectDesk("local:p").page.href).toBe("/issues");
});
it.each(["/conversations?run=r&step=s", "/conversations?terminal=t"])(
  "selects the owner of %s without replacing the previous project's tabs",
  async (href) => {
    mounted = await mount(<Probe />);
    const previous = getProjectDesk("local:p");
    route.key = "local:crm";
    route.projectId = "crm";
    route.href = href;
    await mounted.rerender(<Probe />);
    expect(projectSelectionStore.state.get("local")).toBe("crm");
    expect(getProjectDesk("local:p")).toBe(previous);
    expect(getProjectDesk("local:crm").page.href).toBe(route.href);
  },
);
it("does not turn a host-wide view into a project tab", async () => {
  route.scoped = false;
  route.href = "/inbox";
  mounted = await mount(<Probe />);
  expect(projectDeskStore.state.desks).toEqual({});
});
