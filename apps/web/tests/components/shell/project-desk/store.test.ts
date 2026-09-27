// @vitest-environment happy-dom
import { addDeskTab, readProjectDesks } from "@web/components/shell/project-desk/state";
import { getProjectDesk, projectDeskStore } from "@web/components/shell/project-desk/store";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { beforeEach, expect, it } from "vitest";

beforeEach(() => {
  localStorage.clear();
  projectDeskStore.setState(() => ({ desks: {}, pending: null }));
  projectTabsStore.setState(() => []);
});
it("migrates the remembered route without changing existing project preferences", () => {
  projectTabsStore.setState(() => [{ key: "local:p", route: "/runs/r1/diff" }]);
  expect(getProjectDesk("local:p").page.href).toBe("/runs/r1/diff");
  expect(projectTabsStore.state).toHaveLength(1);
});
it("ignores an outgoing route during a project switch, then records only the arrival", () => {
  projectDeskStore.actions.record("local:a", { href: "/files", label: "Files" });
  projectDeskStore.actions.edit("local:a", (desk) =>
    addDeskTab(desk, "issues", { href: "/issues", label: "Issues" }),
  );
  const before = getProjectDesk("local:a");
  projectDeskStore.actions.expect("remote:a", "/conversations?run=r2&step=s2");
  projectDeskStore.actions.record("remote:a", { href: "/issues", label: "Issues" });
  projectDeskStore.actions.record("local:a", {
    href: "/conversations?run=r2&step=s2",
    label: "Other thread",
  });
  expect(projectDeskStore.state.desks["remote:a"]).toBeUndefined();
  expect(getProjectDesk("local:a")).toBe(before);
  projectDeskStore.actions.record("remote:a", {
    href: "/conversations?run=r2&step=s2",
    label: "Other thread",
  });
  expect(getProjectDesk("remote:a").page.label).toBe("Other thread");
  expect(getProjectDesk("local:a")).toBe(before);
  expect(projectDeskStore.state.pending).toBeNull();
  expect(readProjectDesks()).toEqual(projectDeskStore.state.desks);
});
