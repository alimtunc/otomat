// @vitest-environment happy-dom
import type { ExecutionHostSelectResult } from "@otomat/domain";
import { projectDeskStore } from "@web/components/shell/project-desk/store";
import { readSelectedProjectIds } from "@web/components/shell/project-selection/selection";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { activeHostStore } from "@web/lib/active-host";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { fakeDesktopBridge } from "#support/desktop-bridge";
import { mountWithQuery, type Mounted } from "#support/mount";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

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
let select: (switcherId: string, href?: string) => void = () => undefined;

function Probe() {
  select = useProjectSwitcher().selectProject;
  return null;
}

beforeEach(() => {
  navigate.mockReset();
  projectTabsStore.setState(() => []);
  projectDeskStore.setState(() => ({ desks: {}, pending: null }));
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

it("records the picked project's host membership without creating a view tab", async () => {
  await renderSwitcher();

  await act(async () => {
    select("local:p2");
  });

  expect(projectTabsStore.state).toEqual([{ key: "local:p2", route: null }]);
  expect(projectDeskStore.state.desks).toEqual({});
});

it("expects no desk arrival when the destination is outside the project's views", async () => {
  await renderSwitcher();

  await act(async () => select("local:p2", "/settings/project"));

  expect(navigate).toHaveBeenCalledWith({ href: "/settings/project" });
  expect(projectDeskStore.state.pending).toBeNull();
});

it("restores the view the picked project was left on", async () => {
  projectTabsStore.setState(() => [{ key: "local:p2", route: "/runs/run-3/diff" }]);

  await renderSwitcher();
  await act(async () => select("local:p2"));

  expect(navigate).toHaveBeenCalledWith({ href: "/runs/run-3/diff" });
});

it("opens the project home when it has no remembered view", async () => {
  await renderSwitcher();
  await act(async () => select("local:p2"));

  expect(navigate).toHaveBeenCalledWith({ href: "/project" });
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
