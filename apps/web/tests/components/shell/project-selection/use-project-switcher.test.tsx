// @vitest-environment happy-dom
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const navigate = vi.fn();
let pathname = "/issues";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname } }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Otomat", root_path: "/repos/otomat", has_repository: true },
      { id: "p2", name: "Cockpit", root_path: "/repos/cockpit", has_repository: true },
    ],
  }),
}));

vi.mock("@web/components/shell/use-host-projects", () => ({
  useHostProjects: () => ({ data: [] }),
}));

const mounted: Mounted[] = [];
let select: (switcherId: string) => void = () => undefined;

function Probe() {
  select = useProjectSwitcher().selectProject;
  return null;
}

beforeEach(() => {
  pathname = "/issues";
  navigate.mockReset();
  projectTabsStore.setState(() => []);
  window.localStorage.clear();
});

afterEach(async () => {
  for (const instance of mounted.splice(0)) await instance.cleanup();
  document.body.replaceChildren();
  window.localStorage.clear();
});

async function renderSwitcher(): Promise<void> {
  mounted.push(await mount(<Probe />));
}

it("opens no tab of its own: picking a project only switches to it", async () => {
  await renderSwitcher();

  await act(async () => {
    select("local:p2");
  });

  expect(projectTabsStore.state).toEqual([]);
});

it("restores the view the picked project was left on", async () => {
  projectTabsStore.setState(() => [{ key: "local:p2", route: "/runs/run-3/diff" }]);
  pathname = "/issues/issue-7";

  await renderSwitcher();
  await act(async () => select("local:p2"));

  expect(navigate).toHaveBeenCalledWith({ href: "/runs/run-3/diff" });
});

it("leaves the other project's detail view for the issue list", async () => {
  pathname = "/issues/issue-7";

  await renderSwitcher();
  await act(async () => select("local:p2"));

  expect(navigate).toHaveBeenCalledWith({ href: "/issues" });
});

it("stays where it is when the picked project has no view of its own yet", async () => {
  await renderSwitcher();
  await act(async () => select("local:p2"));

  expect(navigate).not.toHaveBeenCalled();
});
