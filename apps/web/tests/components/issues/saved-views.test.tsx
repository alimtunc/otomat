// @vitest-environment happy-dom
import { IssueViewBar } from "@web/components/issues/views/bar";
import { useIssueViews } from "@web/components/issues/views/use-issue-views";
import { findView } from "@web/lib/issue/saved-view";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { setInputValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const MINE: IssuesViewConfig = { ...DEFAULT_ISSUES_VIEW_CONFIG, grouping: "assignee" };

const opened = vi.fn();
const reset = vi.fn();
const mounted: Mounted[] = [];

function ViewsHarness({ config, dirty }: { config: IssuesViewConfig; dirty: boolean }) {
  const views = useIssueViews("project-1");
  return (
    <IssueViewBar
      views={views}
      active={findView(views.set, views.set.activeId)}
      config={config}
      dirty={dirty}
      onOpenView={opened}
      onReset={reset}
    />
  );
}

async function renderBar(config: IssuesViewConfig = MINE, dirty = true): Promise<void> {
  mounted.push(await mount(<ViewsHarness config={config} dirty={dirty} />));
}

function tabs(): string[] {
  return [...document.body.querySelectorAll("[role='tab']")].map(
    (tab) => tab.textContent?.trim() ?? "",
  );
}

function selectedTab(): string | undefined {
  return document.body.querySelector("[role='tab'][aria-selected='true']")?.textContent?.trim();
}

async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("target not found");
  await act(async () => {
    element.click();
  });
}

function menuItem(text: string): Element | undefined {
  return [...document.body.querySelectorAll("[role='menuitem']")].find(
    (item) => item.textContent?.trim() === text,
  );
}

async function openMenu(viewName: string): Promise<void> {
  await click(document.body.querySelector(`[aria-label="View actions for ${viewName}"]`));
}

async function submitName(name: string, submitLabel: string): Promise<void> {
  const input = document.body.querySelector<HTMLInputElement>("input[aria-label='View name']");
  if (input === null) throw new Error("name input not found");
  await act(async () => {
    setInputValue(input, name);
  });
  await click(findButton(submitLabel));
}

async function saveAs(name: string): Promise<void> {
  await click(findButton("Save as view"));
  await submitName(name, "Save view");
}

beforeEach(() => {
  window.localStorage.clear();
  opened.mockClear();
  reset.mockClear();
});

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("starts on the system view, whose configuration can only become a new view", async () => {
  await renderBar(DEFAULT_ISSUES_VIEW_CONFIG, false);
  expect(tabs()).toEqual(["All issues"]);
  expect(selectedTab()).toBe("All issues");
  expect(findButton("Save changes")).toBeUndefined();

  const [entry] = mounted.splice(0, 1);
  await entry.cleanup();
  await renderBar(MINE, true);
  expect(findButton("Save changes")).toBeUndefined();
  expect(findButton("Save as view")).toBeDefined();
  expect(findButton("Reset")).toBeDefined();
});

it("saves the current configuration as a named tab and opens it", async () => {
  await renderBar();
  await saveAs("My work");

  expect(tabs()).toEqual(["All issues", "My work"]);
  expect(selectedTab()).toBe("My work");
  expect(opened).toHaveBeenCalledTimes(1);
  expect(opened.mock.calls[0][0]).not.toBe("all-issues");
});

it("keeps each tab's own configuration and restores them after a remount", async () => {
  await renderBar(MINE);
  await saveAs("Mine");
  const [first] = mounted.splice(0, 1);
  await first.cleanup();

  await renderBar({ ...DEFAULT_ISSUES_VIEW_CONFIG, sort: "title" });
  await saveAs("Theirs");
  const [second] = mounted.splice(0, 1);
  await second.cleanup();

  await renderBar();
  expect(tabs()).toEqual(["All issues", "Mine", "Theirs"]);

  const stored: {
    "project-1": { saved: { name: string; config: IssuesViewConfig }[] };
  } = JSON.parse(window.localStorage.getItem("otomat.issue-views") ?? "{}");
  const saved = stored["project-1"].saved;
  expect(saved.map((view) => view.name)).toEqual(["Mine", "Theirs"]);
  expect(saved[0].config.grouping).toBe("assignee");
  expect(saved[1].config.sort).toBe("title");
  expect(Object.keys(saved[0].config)).not.toContain("layout");
});

it("renames, duplicates and reorders saved views", async () => {
  await renderBar();
  await saveAs("Mine");

  await openMenu("Mine");
  await click(menuItem("Duplicate view"));
  await submitName("Mine copy", "Duplicate");
  expect(tabs()).toEqual(["All issues", "Mine", "Mine copy"]);

  await openMenu("Mine copy");
  await click(menuItem("Rename view"));
  await submitName("Review queue", "Rename");
  expect(tabs()).toEqual(["All issues", "Mine", "Review queue"]);

  await openMenu("Review queue");
  await click(menuItem("Move left"));
  expect(tabs()).toEqual(["All issues", "Review queue", "Mine"]);
});

it("asks before a delete that would drop unsaved changes, then falls back to All issues", async () => {
  await renderBar();
  await saveAs("Mine");

  await openMenu("Mine");
  await click(menuItem("Delete view"));
  expect(document.body.textContent).toContain("This view has unsaved changes");
  expect(tabs()).toEqual(["All issues", "Mine"]);

  await click(findButton("Delete view"));
  expect(tabs()).toEqual(["All issues"]);
  expect(opened).toHaveBeenLastCalledWith("all-issues");
});
