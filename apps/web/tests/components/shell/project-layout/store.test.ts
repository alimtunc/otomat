// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

async function startApp() {
  vi.resetModules();
  const { projectLayoutStore } = await import("@web/components/shell/project-layout/store");
  return projectLayoutStore;
}

afterEach(() => {
  window.localStorage.clear();
});

it("restores the arrangement the operator made before a restart", async () => {
  const before = await startApp();
  before.actions.addGroup("CRM");
  const groupId = before.state.groups[0]?.id ?? "";
  before.actions.orderSection(groupId, ["local:crm-api", "local:crm-web"]);
  before.actions.orderSection(null, ["vps-1:site"]);
  before.actions.toggleGroup(groupId);
  before.actions.setIcon("local:crm-api", "users");

  const after = await startApp();

  expect(after.state).toEqual({
    ungrouped: ["vps-1:site"],
    groups: [
      { id: groupId, name: "CRM", collapsed: true, projects: ["local:crm-api", "local:crm-web"] },
    ],
    icons: { "local:crm-api": "users" },
  });
});
