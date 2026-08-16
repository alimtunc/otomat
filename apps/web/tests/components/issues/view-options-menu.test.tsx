// @vitest-environment happy-dom
import { resolveStatus, TONE_TEXT } from "@otomat/ui";
import { IssueViewOptionsMenu } from "@web/components/issues/view-options/menu";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import { NO_ADVANCED_FILTERS, type AdvancedIssueFilters } from "@web/lib/issue/filters";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { menuSectionLabels } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const OPTIONS: IssueFilterOptions = {
  assignees: [{ value: "Ada", label: "Ada" }],
  linearStates: [],
  labels: [],
  projects: [{ value: "p1", label: "otomat" }],
};

const LINEAR_STATES = [{ value: "In Progress", label: "In Progress", color: "#f00" }];

const mounted: Mounted[] = [];

interface Setup {
  config?: Partial<IssuesViewConfig>;
  advanced?: Partial<AdvancedIssueFilters>;
  options?: Partial<IssueFilterOptions>;
  linearMapped?: boolean;
  dirty?: boolean;
}

interface Rendered {
  trigger: HTMLButtonElement;
  onChange: ReturnType<typeof vi.fn>;
  onReset: ReturnType<typeof vi.fn>;
}

async function render(setup: Setup = {}): Promise<Rendered> {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const entry = await mount(
    <IssueViewOptionsMenu
      config={{
        ...DEFAULT_ISSUES_VIEW_CONFIG,
        ...setup.config,
        advanced: { ...NO_ADVANCED_FILTERS, ...setup.advanced },
      }}
      options={{ ...OPTIONS, ...setup.options }}
      linearMapped={setup.linearMapped ?? false}
      dirty={setup.dirty ?? false}
      onChange={onChange}
      onReset={onReset}
    />,
  );
  mounted.push(entry);
  // The menu portals out of the container, so the trigger is the only button left in it.
  const trigger = entry.container.querySelector("button");
  if (trigger === null) throw new Error("the view options trigger is missing");
  return { trigger, onChange, onReset };
}

async function open(setup: Setup = {}): Promise<Rendered> {
  const rendered = await render(setup);
  await act(async () => rendered.trigger.click());
  return rendered;
}

function submenu(label: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[aria-label^='${label}:']`);
  if (row === null) throw new Error(`the ${label} submenu trigger is missing`);
  return row;
}

async function openSubmenu(label: string): Promise<void> {
  await act(async () => submenu(label).click());
}

function byRole(role: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[role='${role}']`)];
}

function named(role: string, text: string): HTMLElement {
  const found = byRole(role).find((item) => item.textContent?.trim() === text);
  if (found === undefined) throw new Error(`the ${text} ${role} is missing`);
  return found;
}

function menuItem(text: string): HTMLElement | undefined {
  return byRole("menuitem").find((item) => item.textContent?.trim() === text);
}

function choices(): string[] {
  return byRole("menuitemradio").map((item) => item.textContent?.trim() ?? "");
}

function choice(text: string): HTMLElement {
  return named("menuitemradio", text);
}

function check(text: string): HTMLElement {
  return named("menuitemcheckbox", text);
}

function sectionLabel(name: string): HTMLElement | undefined {
  return menuSectionLabels().find((label) => label.textContent?.trim() === name);
}

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("summarises the whole view on one ellipsised trigger", async () => {
  const { trigger } = await open({
    config: { grouping: "label", sort: "title" },
    advanced: { projects: ["p1"], assignee: "Ada" },
  });

  expect(trigger.querySelector(".truncate")?.textContent).toBe("Label · Title · 2 filters");
  expect(trigger.getAttribute("aria-label")).toBe("View options: Label · Title · 2 filters");
});

it("configures grouping, sorting and every generic filter axis from that one trigger", async () => {
  await open();

  expect(submenu("Group").getAttribute("aria-label")).toContain("Status");
  expect(submenu("Sort").getAttribute("aria-label")).toContain("Priority");
  for (const axis of ["Status", "Sources", "Project", "Assignee", "Priority"]) {
    expect(submenu(axis)).toBeDefined();
  }
});

it("applies a grouping without leaving the menu open on a stale value", async () => {
  const { onChange } = await open();
  await openSubmenu("Group");
  await act(async () => choice("Assignee").click());

  expect(onChange).toHaveBeenCalledWith({ grouping: "assignee" });
});

it("applies a sort order, and no longer offers the dropped Last synced one", async () => {
  const { onChange } = await open();
  await openSubmenu("Sort");
  expect(choices()).toEqual(["Priority", "Status", "Title"]);

  await act(async () => choice("Title").click());
  expect(onChange).toHaveBeenCalledWith({ sort: "title" });
});

it("leads every status with the icon and colour the rest of the app reads from", async () => {
  await open();
  await openSubmenu("Status");

  const ready = resolveStatus("issue", "ready");
  const glyph = check(ready.label).firstElementChild?.querySelector("svg");
  expect(glyph).not.toBeNull();
  expect(glyph?.getAttribute("class")).toContain(TONE_TEXT[ready.tone]);
});

it("recaps a wide selection as two labels and a count, keeping the whole of it reachable", async () => {
  await open({
    advanced: { statuses: ["backlog", "ready", "running", "failed", "reviewing", "done"] },
  });

  const row = submenu("Status");
  expect(row.textContent).toContain("Backlog, Ready +4");
  expect(row.textContent).not.toContain("Running");
  expect(row.getAttribute("aria-label")).toBe(
    "Status: Backlog, Ready +4. Backlog, Ready, Running, Failed, Reviewing, Done",
  );
});

it("sections a configured source under its own name and icon, and sections no other", async () => {
  await open({ linearMapped: true, options: { linearStates: LINEAR_STATES } });

  const label = sectionLabel("Linear");
  expect(label?.querySelector("svg")).not.toBeNull();
  expect(submenu("Linear state")).toBeDefined();
  expect(menuSectionLabels().map((section) => section.textContent?.trim())).toEqual(["Linear"]);
});

it("offers no section for a source the project has not configured", async () => {
  await open({ linearMapped: false, options: { linearStates: LINEAR_STATES } });

  expect(menuSectionLabels()).toEqual([]);
  expect(document.querySelector("[aria-label^='Linear state:']")).toBeNull();
});

it("drops a source's own options as soon as it leaves the Sources filter", async () => {
  await open({
    linearMapped: true,
    options: { linearStates: LINEAR_STATES },
    advanced: { sources: ["local"], labels: [] },
  });

  expect(sectionLabel("Linear")).toBeUndefined();
  for (const axis of ["Status", "Sources", "Project", "Assignee", "Priority"]) {
    expect(submenu(axis)).toBeDefined();
  }
});

it("filters on a source state from that section alone", async () => {
  const { onChange } = await open({
    linearMapped: true,
    options: { linearStates: LINEAR_STATES },
  });
  await openSubmenu("Linear state");
  await act(async () => check("In Progress").click());

  expect(onChange).toHaveBeenCalledWith({
    advanced: expect.objectContaining({ linearStates: ["In Progress"] }),
  });
});

it("builds a multi-selection up without closing the menu on each pick", async () => {
  const { onChange } = await open();
  await openSubmenu("Project");
  await act(async () => check("otomat").click());

  expect(onChange).toHaveBeenCalledWith({
    advanced: expect.objectContaining({ projects: ["p1"] }),
  });
  expect(document.querySelector("[role='menuitemcheckbox']")).not.toBeNull();
});

it("offers Clear filters only once something is filtered", async () => {
  await open();
  expect(menuItem("Clear filters")).toBeUndefined();

  const [clean] = mounted.splice(0, 1);
  await clean.cleanup();
  document.body.replaceChildren();

  const { onChange } = await open({ advanced: { projects: ["p1"] } });
  const clear = menuItem("Clear filters");
  if (clear === undefined) throw new Error("Clear filters is missing");
  await act(async () => clear.click());

  expect(onChange).toHaveBeenCalledWith({ advanced: NO_ADVANCED_FILTERS });
});

it("offers Reset view only against a view the screen has diverged from", async () => {
  await open();
  expect(menuItem("Reset view")).toBeUndefined();

  const [saved] = mounted.splice(0, 1);
  await saved.cleanup();
  document.body.replaceChildren();

  const { onReset } = await open({ dirty: true });
  const reset = menuItem("Reset view");
  if (reset === undefined) throw new Error("Reset view is missing");
  await act(async () => reset.click());

  expect(onReset).toHaveBeenCalledTimes(1);
});

it("opens, walks and picks with the keyboard alone", async () => {
  const { trigger, onChange } = await render({ config: { sort: "title" } });

  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" }),
    );
  });
  expect(document.querySelector("[role='menu']")).not.toBeNull();

  const sort = submenu("Sort");
  await act(async () => {
    sort.focus();
    sort.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" }),
    );
  });

  const priority = choice("Priority");
  await act(async () => {
    priority.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
    );
  });

  expect(onChange).toHaveBeenCalledWith({ sort: "priority" });
});

it("reaches a source section and picks from it with the keyboard alone", async () => {
  const { onChange } = await open({
    linearMapped: true,
    options: { linearStates: LINEAR_STATES },
  });

  const row = submenu("Linear state");
  await act(async () => {
    row.focus();
    row.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" }),
    );
  });

  const state = check("In Progress");
  await act(async () => {
    state.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
    );
  });

  expect(onChange).toHaveBeenCalledWith({
    advanced: expect.objectContaining({ linearStates: ["In Progress"] }),
  });
});
