// @vitest-environment happy-dom
import { useIssuesLayout } from "@web/components/issues/list/use-issues-layout";
import { useIssueViews } from "@web/components/issues/views/use-issue-views";
import { DEFAULT_ISSUES_VIEW_CONFIG } from "@web/lib/issue/view-config";
import { act } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount, type Mounted } from "#support/mount";

const mounted: Mounted[] = [];

function LayoutHarness({ projectId }: { projectId: string }) {
  const views = useIssueViews(projectId);
  const { layout, select } = useIssuesLayout(projectId);
  return (
    <div>
      <span aria-label="layout">{layout}</span>
      <span aria-label="view">{views.set.activeId}</span>
      <button onClick={() => select("list")}>List</button>
      <button onClick={() => views.create("Mine", DEFAULT_ISSUES_VIEW_CONFIG)}>Save view</button>
      <button onClick={() => views.select(views.set.system.id)}>All issues</button>
    </div>
  );
}

async function render(projectId = "project-1"): Promise<void> {
  mounted.push(await mount(<LayoutHarness projectId={projectId} />));
}

async function click(label: string): Promise<void> {
  const button = findButton(label);
  if (button === undefined) throw new Error(`${label} is missing`);
  await act(async () => button.click());
}

function shown(label: string): string {
  return document.body.querySelector(`[aria-label='${label}']`)?.textContent ?? "";
}

async function remount(projectId?: string): Promise<void> {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  await render(projectId);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("keeps the chosen layout while the reviewer moves between views", async () => {
  await render();
  await click("List");
  expect(shown("layout")).toBe("list");

  await click("Save view");
  expect(shown("view")).not.toBe("all-issues");
  expect(shown("layout")).toBe("list");

  await click("All issues");
  expect(shown("view")).toBe("all-issues");
  expect(shown("layout")).toBe("list");
});

it("restores the last layout of that project after a refresh", async () => {
  await render();
  await click("List");
  await remount();

  expect(shown("layout")).toBe("list");
});

it("gives another project its own layout rather than the last one displayed", async () => {
  await render();
  await click("List");
  await remount("project-2");

  expect(shown("layout")).toBe("board");
});
