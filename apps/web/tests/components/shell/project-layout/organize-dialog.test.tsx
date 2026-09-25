// @vitest-environment happy-dom
import type { ProjectSummary } from "@otomat/ui";
import {
  readStoredProjectLayout,
  type ProjectLayout,
} from "@web/components/shell/project-layout/layout";
import { OrganizeProjectsDialog } from "@web/components/shell/project-layout/organize-dialog";
import { projectLayoutStore } from "@web/components/shell/project-layout/store";
import { act } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { stubAnimations } from "#support/animations";
import { setInputValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const PROJECTS: ProjectSummary[] = [
  { id: "local:a", name: "Alpha" },
  { id: "local:b", name: "Bravo" },
  { id: "vps-1:c", name: "Charlie", tag: "vps" },
];

stubAnimations();

const mounted: Mounted[] = [];

beforeEach(() => {
  projectLayoutStore.setState(() => ({ ungrouped: [], groups: [], icons: {} }));
});

afterEach(async () => {
  for (const instance of mounted.splice(0)) await instance.cleanup();
  document.body.replaceChildren();
  window.localStorage.clear();
});

async function renderDialog(layout?: ProjectLayout): Promise<void> {
  if (layout !== undefined) projectLayoutStore.setState(() => layout);
  mounted.push(
    await mount(<OrganizeProjectsDialog open onOpenChange={() => {}} projects={PROJECTS} />),
  );
}

function sectionNames(section: string): string[] {
  const element = document.body.querySelector(`section[aria-label="${section}"]`);
  return [...(element?.querySelectorAll("li") ?? [])].map(
    (row) => row.querySelector("span.truncate")?.textContent ?? "",
  );
}

function rowOf(name: string): HTMLLIElement | undefined {
  return [...document.body.querySelectorAll("li")].find((row) => row.textContent?.includes(name));
}

async function dragProject(from: Element | undefined, to: Element | null | undefined) {
  const transfer = new DataTransfer();
  const fire = (type: string, target: Element | null | undefined) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    target?.dispatchEvent(event);
  };
  await act(async () => fire("dragstart", from));
  await act(async () => fire("drop", to));
}

async function chooseIcon(label: string): Promise<void> {
  await act(async () => findLabelled("Icon for Alpha")?.click());
  const item = [...document.body.querySelectorAll<HTMLElement>("[role='menuitemradio']")].find(
    (entry) => entry.textContent === label,
  );
  await act(async () => item?.click());
}

const CRM: ProjectLayout = {
  ungrouped: [],
  groups: [{ id: "crm", name: "CRM", collapsed: false, projects: ["vps-1:c"] }],
  icons: {},
};

it("creates a named group and leaves every project where it was", async () => {
  await renderDialog();
  const input = findLabelled("New group name");
  if (!(input instanceof HTMLInputElement)) throw new Error("new group field missing");

  await act(async () => setInputValue(input, "  CRM  "));
  await act(async () => findButton("Add group")?.click());

  expect(projectLayoutStore.state.groups.map((group) => group.name)).toEqual(["CRM"]);
  expect(sectionNames("Not grouped")).toEqual(["Alpha", "Bravo", "Charlie"]);
  expect(sectionNames("CRM")).toEqual([]);
  expect(input.value).toBe("");
});

it("reorders with the move buttons and keeps the keyboard focus on them", async () => {
  await renderDialog();
  const down = findLabelled("Move Alpha down");

  await act(async () => down?.click());

  expect(sectionNames("Not grouped")).toEqual(["Bravo", "Alpha", "Charlie"]);
  expect(document.activeElement).toBe(findLabelled("Move Alpha down"));
  expect(readStoredProjectLayout().ungrouped).toEqual(["local:b", "local:a", "vps-1:c"]);
});

it("hands the focus to the other move button once a project reaches an end", async () => {
  await renderDialog();

  await act(async () => findLabelled("Move Bravo up")?.click());

  expect(sectionNames("Not grouped")).toEqual(["Bravo", "Alpha", "Charlie"]);
  expect(document.activeElement).toBe(findLabelled("Move Bravo down"));
});

it("moves a project into a group from its group picker", async () => {
  await renderDialog(CRM);

  await act(async () => findLabelled("Group for Alpha")?.click());
  const option = [...document.body.querySelectorAll<HTMLElement>("[role='option']")].find(
    (entry) => entry.textContent === "CRM",
  );
  await act(async () => option?.click());

  expect(sectionNames("CRM")).toEqual(["Charlie", "Alpha"]);
  expect(sectionNames("Not grouped")).toEqual(["Bravo"]);
});

it("takes a project out of its group from its group picker", async () => {
  await renderDialog(CRM);

  await act(async () => findLabelled("Group for Charlie")?.click());
  const option = [...document.body.querySelectorAll<HTMLElement>("[role='option']")].find(
    (entry) => entry.textContent === "Not grouped",
  );
  await act(async () => option?.click());

  expect(sectionNames("Not grouped")).toEqual(["Alpha", "Bravo", "Charlie"]);
  expect(sectionNames("CRM")).toEqual([]);
});

it("drops a dragged project before the row it lands on", async () => {
  await renderDialog(CRM);

  await dragProject(rowOf("Bravo"), rowOf("Charlie"));

  expect(sectionNames("CRM")).toEqual(["Bravo", "Charlie"]);
  expect(sectionNames("Not grouped")).toEqual(["Alpha"]);
});

it("drops a dragged project at the end of the section it lands on", async () => {
  await renderDialog(CRM);

  await dragProject(rowOf("Alpha"), document.body.querySelector("section[aria-label='CRM']"));

  expect(sectionNames("CRM")).toEqual(["Charlie", "Alpha"]);
  expect(sectionNames("Not grouped")).toEqual(["Bravo"]);
});

it("renames a group when its name field loses focus, and refuses an empty name", async () => {
  await renderDialog(CRM);
  const input = findLabelled("Name of group CRM");
  if (!(input instanceof HTMLInputElement)) throw new Error("group name field missing");

  await act(async () => setInputValue(input, " "));
  await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(projectLayoutStore.state.groups[0]?.name).toBe("CRM");

  await act(async () => setInputValue(input, "Clients"));
  await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(projectLayoutStore.state.groups[0]?.name).toBe("Clients");
});

it("reorders and deletes groups without losing their projects", async () => {
  await renderDialog({
    ...CRM,
    groups: [...CRM.groups, { id: "ops", name: "Ops", collapsed: false, projects: ["local:a"] }],
  });

  await act(async () => findLabelled("Move group Ops up")?.click());
  expect(projectLayoutStore.state.groups.map((group) => group.id)).toEqual(["ops", "crm"]);

  await act(async () => findLabelled("Delete group CRM")?.click());
  expect(projectLayoutStore.state.groups.map((group) => group.id)).toEqual(["ops"]);
  expect(sectionNames("Not grouped")).toEqual(["Charlie", "Bravo"]);
});

it("chooses a presentation icon and resets it to the default", async () => {
  await renderDialog();
  await chooseIcon("Rocket");

  expect(projectLayoutStore.state.icons).toEqual({ "local:a": "rocket" });
  expect(findLabelled("Icon for Alpha")?.querySelector("svg")).not.toBeNull();

  await chooseIcon("Default icon");
  expect(projectLayoutStore.state.icons).toEqual({});
  expect(findLabelled("Icon for Alpha")?.textContent).toBe("A");
});
