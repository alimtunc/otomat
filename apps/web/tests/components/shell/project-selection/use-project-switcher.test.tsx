// @vitest-environment happy-dom
import type { ExecutionHostSelectResult } from "@otomat/domain";
import { readSelectedProjectIds } from "@web/components/shell/project-selection/selection";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { activeHostStore } from "@web/lib/active-host";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery, type Mounted } from "#support/mount";

const navigate = vi.fn();
let pathname = "/issues";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string; href: string } }) => string;
  }) => select({ location: { pathname, href: `${pathname}?view=board` } }),
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
  activeHostStore.setState(() => null);
  delete window.otomat;
});

async function renderSwitcher(): Promise<void> {
  mounted.push(await mountWithQuery(<Probe />));
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
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

it("switches the host in place once it answers, then lands on the project's view", async () => {
  const bridge = fakeDesktopBridge();
  let answer: ((result: ExecutionHostSelectResult) => void) | null = null;
  bridge.executionHost.select = () =>
    new Promise((resolve) => {
      answer = resolve;
    });
  window.otomat = bridge;
  projectTabsStore.setState(() => [{ key: "remote:p9", route: "/runs" }]);

  await renderSwitcher();
  await act(async () => {
    select("remote:p9");
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(activeHostStore.state).toBeNull();
  await act(async () => {
    answer?.({ ok: true, url: "http://127.0.0.1:45010" });
  });
  await settle();

  expect(activeHostStore.state).toEqual({ id: "remote", daemonUrl: "http://127.0.0.1:45010" });
  expect(readSelectedProjectIds()).toEqual(new Map([["remote", "p9"]]));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith({ href: "/runs" });
});

it("stays on the current host and view when the host switch fails", async () => {
  const bridge = fakeDesktopBridge();
  bridge.executionHost.select = () =>
    Promise.resolve({ ok: false as const, message: "unreachable" });
  window.otomat = bridge;
  projectTabsStore.setState(() => [{ key: "remote:p9", route: "/runs" }]);

  await renderSwitcher();
  await act(async () => {
    select("remote:p9");
  });
  await settle();

  expect(navigate).not.toHaveBeenCalled();
  expect(activeHostStore.state).toBeNull();
  expect(readSelectedProjectIds()).toEqual(new Map());
});
