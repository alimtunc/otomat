// @vitest-environment happy-dom
import { IssuesFilterPopover } from "@web/components/issues/issues-filter-popover/popover";
import type { IssueFilterOptions } from "@web/lib/issue/filter-options";
import { NO_ADVANCED_FILTERS, type AdvancedIssueFilters } from "@web/lib/issue/filters";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";

const OPTIONS: IssueFilterOptions = {
  assignees: [{ value: "u1", label: "Alim" }],
  linearStates: [],
  labels: [],
  projects: [{ value: "p1", label: "otomat" }],
};

interface Opened {
  mounted: Mounted;
  onChange: ReturnType<typeof vi.fn>;
}

async function open(filters: AdvancedIssueFilters): Promise<Opened> {
  const onChange = vi.fn();
  const mounted = await mount(
    <IssuesFilterPopover filters={filters} options={OPTIONS} onChange={onChange} />,
  );
  // The menu portals out of the container, so the trigger is the only button left in it.
  const trigger = mounted.container.querySelector("button");
  if (trigger === null) throw new Error("the filter trigger is missing");
  await act(async () => trigger.click());
  return { mounted, onChange };
}

function submenu(label: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[aria-label^='${label}:']`);
  if (row === null) throw new Error(`the ${label} submenu trigger is missing`);
  return row;
}

function menuItem(text: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find(
    (item) => item.textContent?.trim() === text,
  );
}

it("summarises each axis on its own row rather than laying the controls out inline", async () => {
  const { mounted } = await open({ ...NO_ADVANCED_FILTERS, projects: ["p1"] });

  expect(submenu("Project").getAttribute("aria-label")).toContain("otomat");
  expect(submenu("Status").getAttribute("aria-label")).toContain("Any status");
  expect(submenu("Assignee").getAttribute("aria-label")).toContain("Anyone");

  await mounted.cleanup();
});

it("builds a multi-selection up without closing the menu on each pick", async () => {
  const { mounted, onChange } = await open(NO_ADVANCED_FILTERS);
  await act(async () => submenu("Project").click());

  const item = document.querySelector<HTMLElement>("[role='menuitemcheckbox']");
  if (item === null) throw new Error("the project checkbox is missing");
  await act(async () => item.click());

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ projects: ["p1"] }));
  expect(document.querySelector("[role='menuitemcheckbox']")).not.toBeNull();

  await mounted.cleanup();
});

it("offers Clear filters only once something is filtered", async () => {
  const clean = await open(NO_ADVANCED_FILTERS);
  expect(menuItem("Clear filters")).toBeUndefined();
  await clean.mounted.cleanup();

  const filtered = await open({ ...NO_ADVANCED_FILTERS, projects: ["p1"] });
  const clear = menuItem("Clear filters");
  if (clear === undefined) throw new Error("Clear filters is missing");
  await act(async () => clear.click());

  expect(filtered.onChange).toHaveBeenCalledWith(NO_ADVANCED_FILTERS);

  await filtered.mounted.cleanup();
});
