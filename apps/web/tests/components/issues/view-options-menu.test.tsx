// @vitest-environment happy-dom
import { IssueViewOptionsMenu } from "@web/components/issues/view-options/menu";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import { NO_ADVANCED_FILTERS, type AdvancedIssueFilters } from "@web/lib/issue/filters";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const OPTIONS: IssueFilterOptions = {
  assignees: [{ value: "Ada", label: "Ada" }],
  linearStates: [],
  labels: [],
  projects: [{ value: "p1", label: "otomat" }],
};

const mounted: Mounted[] = [];

interface Rendered {
  trigger: HTMLButtonElement;
  onChange: ReturnType<typeof vi.fn>;
  onReset: ReturnType<typeof vi.fn>;
}

async function render(
  config: Partial<IssuesViewConfig> = {},
  dirty = false,
  advanced: Partial<AdvancedIssueFilters> = {},
): Promise<Rendered> {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const entry = await mount(
    <IssueViewOptionsMenu
      config={{
        ...DEFAULT_ISSUES_VIEW_CONFIG,
        ...config,
        advanced: { ...NO_ADVANCED_FILTERS, ...advanced },
      }}
      options={OPTIONS}
      dirty={dirty}
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

async function open(...args: Parameters<typeof render>): Promise<Rendered> {
  const rendered = await render(...args);
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

function menuItem(text: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find(
    (item) => item.textContent?.trim() === text,
  );
}

function choice(text: string): HTMLElement {
  const item = [...document.querySelectorAll<HTMLElement>("[role='menuitemradio']")].find(
    (entry) => entry.textContent?.trim() === text,
  );
  if (item === undefined) throw new Error(`the ${text} choice is missing`);
  return item;
}

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("summarises the whole view on one ellipsised trigger", async () => {
  const { trigger } = await open({ grouping: "label", sort: "title" }, false, {
    projects: ["p1"],
    assignee: "Ada",
  });

  expect(trigger.querySelector(".truncate")?.textContent).toBe("Label · Title · 2 filters");
  expect(trigger.getAttribute("aria-label")).toBe("View options: Label · Title · 2 filters");
});

it("configures grouping, sorting and every filter axis from that one trigger", async () => {
  await open();

  expect(submenu("Group").getAttribute("aria-label")).toContain("Status");
  expect(submenu("Sort").getAttribute("aria-label")).toContain("Last synced");
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

it("applies a sort order", async () => {
  const { onChange } = await open();
  await openSubmenu("Sort");
  await act(async () => choice("Priority").click());

  expect(onChange).toHaveBeenCalledWith({ sort: "priority" });
});

it("builds a multi-selection up without closing the menu on each pick", async () => {
  const { onChange } = await open();
  await openSubmenu("Project");

  const item = document.querySelector<HTMLElement>("[role='menuitemcheckbox']");
  if (item === null) throw new Error("the project checkbox is missing");
  await act(async () => item.click());

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

  const { onChange } = await open({}, false, { projects: ["p1"] });
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

  const { onReset } = await open({}, true);
  const reset = menuItem("Reset view");
  if (reset === undefined) throw new Error("Reset view is missing");
  await act(async () => reset.click());

  expect(onReset).toHaveBeenCalledTimes(1);
});

it("opens, walks and picks with the keyboard alone", async () => {
  const { trigger, onChange } = await render({ sort: "title" });

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
