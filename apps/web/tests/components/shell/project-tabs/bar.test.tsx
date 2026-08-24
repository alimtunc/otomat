// @vitest-environment happy-dom
import type { InboxEntry } from "@otomat/domain";
import type { ProjectSummary } from "@otomat/ui";
import { ProjectTabsBar } from "@web/components/shell/project-tabs/bar";
import { projectTabsStore } from "@web/components/shell/project-tabs/store";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { stubAnimations } from "#support/animations";
import { findLabelled } from "#support/dom-queries";
import { inboxEntry } from "#support/inbox";
import { mount, type Mounted } from "#support/mount";

const PROJECTS: ProjectSummary[] = [
  { id: "local:p1", name: "Otomat" },
  { id: "local:p2", name: "Cockpit" },
];

const selectProject = vi.fn();
let projects: ProjectSummary[] = PROJECTS;
let currentSwitcherId: string | undefined = "local:p1";
let entries: InboxEntry[] = [];
let location = { href: "/issues", pathname: "/issues" };

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: { location: typeof location }) => string }) =>
    select({ location }),
}));

vi.mock("@web/api/inbox/queries", () => ({ useInbox: () => ({ data: { entries } }) }));

vi.mock("@web/components/shell/project-selection/use-project-switcher", () => ({
  useProjectSwitcher: () => ({ projects, currentSwitcherId, selectProject }),
}));

stubAnimations();

const mounted: Mounted[] = [];

beforeEach(() => {
  projects = PROJECTS;
  currentSwitcherId = "local:p1";
  entries = [];
  location = { href: "/issues", pathname: "/issues" };
  selectProject.mockReset();
  projectTabsStore.setState(() => [
    { key: "local:p1", route: null },
    { key: "local:p2", route: null },
  ]);
});

afterEach(async () => {
  for (const instance of mounted.splice(0)) await instance.cleanup();
  document.body.replaceChildren();
  window.localStorage.clear();
});

async function renderBar(): Promise<HTMLElement> {
  const instance = await mount(<ProjectTabsBar />);
  mounted.push(instance);
  return instance.container;
}

function tabButtons(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>("nav button")].filter(
    (button) => button.getAttribute("aria-label") === null,
  );
}

function tabLabels(): string[] {
  return tabButtons().map((button) => button.querySelector("span")?.textContent ?? "");
}

function tabBadges(): (string | undefined)[] {
  return tabButtons().map(
    (button) => button.querySelector("[data-slot='badge']")?.textContent ?? undefined,
  );
}

it("shows one tab per project and marks the selected one", async () => {
  await renderBar();

  expect(tabLabels()).toEqual(["Otomat", "Cockpit"]);
  expect(tabButtons().map((button) => button.getAttribute("aria-current"))).toEqual(["page", null]);
});

it("badges each project with its own unresolved entries", async () => {
  entries = [
    inboxEntry({ id: "run:a", project: { id: "p1", name: "Otomat" } }),
    inboxEntry({ id: "run:b", project: { id: "p1", name: "Otomat" } }),
    inboxEntry({ id: "run:c", state: "resolved", project: { id: "p2", name: "Cockpit" } }),
  ];

  await renderBar();

  expect(tabBadges()).toEqual(["2", undefined]);
});

it("activates the tab the operator clicks", async () => {
  await renderBar();

  await act(async () => {
    tabButtons()[1]?.click();
  });

  expect(selectProject).toHaveBeenCalledWith("local:p2");
});

it("activates a tab from its Cmd-digit shortcut", async () => {
  await renderBar();

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2", metaKey: true }));
  });

  expect(selectProject).toHaveBeenCalledWith("local:p2");
});

it("cycles through the tabs with Ctrl+Tab", async () => {
  await renderBar();

  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true }));
  });

  expect(selectProject).toHaveBeenCalledWith("local:p2");
});

it("cycles backwards and wraps around with Ctrl+Shift+Tab", async () => {
  await renderBar();

  await act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true, shiftKey: true }),
    );
  });

  expect(selectProject).toHaveBeenCalledWith("local:p2");
});

it("ignores a tab shortcut typed into an editable control", async () => {
  await renderBar();
  const input = document.body.appendChild(document.createElement("input"));

  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "2", metaKey: true, bubbles: true }));
  });

  expect(selectProject).not.toHaveBeenCalled();
});

it("remembers the view the active project is on", async () => {
  location = { href: "/issues/issue-7?panel=diff", pathname: "/issues/issue-7" };

  await renderBar();

  expect(projectTabsStore.state).toEqual([
    { key: "local:p1", route: "/issues/issue-7?panel=diff" },
    { key: "local:p2", route: null },
  ]);
});

it("leaves the tabs alone on a route that answers for every project", async () => {
  location = { href: "/settings/project", pathname: "/settings/project" };

  await renderBar();

  expect(projectTabsStore.state.map((tab) => tab.route)).toEqual([null, null]);
});

it("hands the selection to the neighbouring tab when the active one is closed", async () => {
  await renderBar();

  await act(async () => {
    findLabelled("Close Otomat")?.click();
  });

  expect(selectProject).toHaveBeenCalledWith("local:p2");
  expect(projectTabsStore.state).toEqual([{ key: "local:p2", route: null }]);
});

it("keeps the selection when an inactive tab is closed", async () => {
  await renderBar();

  await act(async () => {
    findLabelled("Close Cockpit")?.click();
  });

  expect(selectProject).not.toHaveBeenCalled();
  expect(projectTabsStore.state.map((tab) => tab.key)).toEqual(["local:p1"]);
});

it("offers no close control while a single project is open", async () => {
  projects = [{ id: "local:p1", name: "Otomat" }];
  projectTabsStore.setState(() => [{ key: "local:p1", route: null }]);

  await renderBar();

  expect(findLabelled("Close Otomat")).toBeUndefined();
});
