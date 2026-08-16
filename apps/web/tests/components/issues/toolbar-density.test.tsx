// @vitest-environment happy-dom
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssuesToolbar } from "@web/components/issues/list/toolbar";
import { NewIssueContext } from "@web/components/shell/new-issue-context";
import { NO_ADVANCED_FILTERS } from "@web/lib/issue/filters";
import { DEFAULT_ISSUES_VIEW_CONFIG, type IssuesViewConfig } from "@web/lib/issue/view-config";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { linearIssueContract } from "#support/issue";
import { mount, type Mounted } from "#support/mount";

const SYNC: ProjectLinearSync = {
  status: null,
  running: false,
  refresh: vi.fn(),
  refreshIfStale: vi.fn(),
};

const ISSUES = [
  linearIssueContract({
    id: "issue-1",
    source_assignee_name: "Ada",
    source_state_name: "In Progress",
    source_labels: [{ name: "bug", color: "#f00" }],
  }),
];

const CROWDED: IssuesViewConfig = {
  ...DEFAULT_ISSUES_VIEW_CONFIG,
  grouping: "assignee",
  sort: "priority",
  advanced: {
    ...NO_ADVANCED_FILTERS,
    statuses: ["running", "reviewing", "pr_open"],
    sources: ["linear"],
    labels: ["bug"],
    linearStates: ["In Progress"],
    assignee: "Ada",
    priority: 1,
  },
};

const mounted: Mounted[] = [];

async function render(config: IssuesViewConfig): Promise<HTMLElement> {
  const entry = await mount(
    <NewIssueContext.Provider value={() => {}}>
      <IssuesToolbar
        config={config}
        issues={ISSUES}
        projectNames={new Map([["project-1", "otomat"]])}
        sync={SYNC}
        dirty={false}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    </NewIssueContext.Provider>,
  );
  mounted.push(entry);
  return entry.container;
}

function viewOptionTriggers(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll("button")].filter((button) =>
    button.getAttribute("aria-label")?.startsWith("View options:"),
  );
}

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("configures a fully loaded view from one control instead of a row of inputs", async () => {
  const container = await render(CROWDED);

  expect(viewOptionTriggers(container)).toHaveLength(1);
  for (const input of ["Group", "Sort", "Filter"]) {
    expect(container.textContent).not.toContain(input);
  }
});

it("keeps the strip on one line by ellipsising the summary, never the actions beside it", async () => {
  const container = await render(CROWDED);
  const [trigger] = viewOptionTriggers(container);

  expect(container.firstElementChild?.className).not.toContain("flex-wrap");
  expect(trigger?.querySelector(".truncate")).not.toBeNull();
  expect(findButton("New issue")).toBeDefined();
});
