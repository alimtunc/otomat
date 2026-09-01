// @vitest-environment happy-dom
import type { LinearSyncStatusContract } from "@otomat/domain";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssuesToolbar } from "@web/components/issues/list/toolbar";
import { DEFAULT_ISSUES_VIEW_CONFIG } from "@web/lib/issue/view-config";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { menuSectionLabels } from "#support/dom-queries";
import { linearIssueContract } from "#support/issue";
import { mount, type Mounted } from "#support/mount";

const ISSUES = [
  linearIssueContract({
    id: "issue-1",
    source_state_name: "In Progress",
    source_state_color: "#f00",
  }),
];

function sync(sources: number | null): ProjectLinearSync {
  const status: LinearSyncStatusContract | null =
    sources === null
      ? null
      : {
          project_id: "project-1",
          sources,
          running: false,
          last_synced_at: null,
          last_result: null,
          last_error: null,
        };
  return { status, running: false, refresh: vi.fn(), refreshIfStale: vi.fn() };
}

const mounted: Mounted[] = [];

async function openViewOptions(mapped: number | null): Promise<void> {
  const entry = await mount(
    <IssuesToolbar
      config={DEFAULT_ISSUES_VIEW_CONFIG}
      issues={ISSUES}
      projectNames={new Map([["project-1", "otomat"]])}
      sync={sync(mapped)}
      dirty={false}
      onChange={vi.fn()}
      onReset={vi.fn()}
    />,
  );
  mounted.push(entry);
  const trigger = entry.container.querySelector<HTMLButtonElement>(
    "button[aria-label^='View options:']",
  );
  if (trigger === null) throw new Error("the view options trigger is missing");
  await act(async () => trigger.click());
}

function sectionNames(): string[] {
  return menuSectionLabels().map((label) => label.textContent?.trim() ?? "");
}

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("sections the sources mapped to the project, and only those", async () => {
  await openViewOptions(1);

  expect(sectionNames()).toEqual(["Linear"]);
  expect(document.querySelector("[aria-label^='Linear state:']")).not.toBeNull();
});

it("reads a project the daemon has not answered for as nothing mapped", async () => {
  await openViewOptions(null);

  expect(sectionNames()).toEqual([]);
});

it("offers no source section to a project with nothing mapped", async () => {
  await openViewOptions(0);

  expect(sectionNames()).toEqual([]);
  expect(document.querySelector("[aria-label^='Linear state:']")).toBeNull();
});
