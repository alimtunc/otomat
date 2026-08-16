// @vitest-environment happy-dom
import { RunsTable } from "@web/components/runs/list/table";
import { RunsToolbar } from "@web/components/runs/list/toolbar";
import { useRunsView } from "@web/components/runs/list/use-runs-view";
import { groupRunsByIssue, visibleRunGroups } from "@web/lib/run/grouping";
import { DEFAULT_RUNS_VIEW_CONFIG, type RunsViewConfig } from "@web/lib/run/view-config";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { linearIssueContract, openWorkspace } from "#support/issue";
import { mount, type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";
import { runContract as run } from "#support/run";

const mounted: Mounted[] = [];

/** The divergence the group header must not flatten: the source status stays `ready` while a run executes. */
const ISSUE = linearIssueContract({
  id: "issue-1",
  title: "Group the runs",
  status: "ready",
  execution: { state: "running", run_id: "r1" },
  workspace: openWorkspace("r1", "running"),
  source_identifier: "OTO-42",
});

/** The trigger carries its active-filter count, so it is found by prefix rather than exact text. */
function filterTrigger(): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((button) =>
    button.textContent?.startsWith("Filter"),
  );
}

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

it("heads each group with the issue's key, title, link and run count, and lists its runs under it", async () => {
  const groups = groupRunsByIssue(
    [run({ id: "r1" }), run({ id: "r2", updated_at: "2026-07-21T10:00:00.000Z" })],
    [ISSUE],
  );
  const rendered = await mountRouted(<RunsTable groups={groups} />);
  mounted.push(rendered);

  const header = rendered.container.querySelector("th[scope='colgroup']");
  expect(header?.textContent).toContain("OTO-42");
  expect(header?.textContent).toContain("Group the runs");
  expect(header?.querySelector(":scope > div > span:last-child")?.textContent).toBe("2");
  expect(header?.querySelector("a")?.getAttribute("href")).toBe("/issues/issue-1");
  expect(rendered.container.querySelectorAll("tbody:last-of-type tr")).toHaveLength(2);
});

it("states each run's own status and never the issue's, whichever way the two diverge", async () => {
  const groups = groupRunsByIssue(
    [
      run({ id: "r1", status: "running" }),
      run({ id: "r2", status: "failed", updated_at: "2026-07-19T10:00:00.000Z" }),
    ],
    [ISSUE],
  );
  const rendered = await mountRouted(<RunsTable groups={groups} />);
  mounted.push(rendered);

  const header = rendered.container.querySelector("th[scope='colgroup']");
  expect(header?.textContent).not.toContain("Ready");
  expect(header?.textContent).not.toContain("Running");
  const rows = [...rendered.container.querySelectorAll("tbody:last-of-type tr")];
  expect(rows[0]?.textContent).toContain("Running");
  expect(rows[1]?.textContent).toContain("Failed");
});

it("names the issue honestly when the project does not list it", async () => {
  const groups = groupRunsByIssue([run({ issue_id: "issue-gone" })], []);
  const rendered = await mountRouted(<RunsTable groups={groups} />);
  mounted.push(rendered);
  expect(rendered.container.querySelector("th[scope='colgroup']")?.textContent).toContain(
    "Issue not loaded",
  );
});

it("says what its filters are hiding, and stays quiet when they hide nothing", async () => {
  const hidden = visibleRunGroups(
    groupRunsByIssue(
      [run({ id: "r1", status: "failed" }), run({ id: "r2", issue_id: "issue-2" })],
      [ISSUE, linearIssueContract({ id: "issue-2", status: "done" })],
    ),
    { showFailed: false, showDoneIssues: false },
  );
  mounted.push(
    await mount(
      <RunsToolbar
        config={{ showFailed: false, showDoneIssues: false }}
        hidden={{ runs: hidden.hiddenRuns, groups: hidden.hiddenGroups }}
        onChange={vi.fn()}
      />,
    ),
  );
  expect(document.body.textContent).toContain("1 issue and 1 failed run hidden");
  expect(filterTrigger()?.textContent).toBe("Filter1");

  const [entry] = mounted.splice(0, 1);
  await entry.cleanup();
  mounted.push(
    await mount(
      <RunsToolbar
        config={DEFAULT_RUNS_VIEW_CONFIG}
        hidden={{ runs: 0, groups: 0 }}
        onChange={vi.fn()}
      />,
    ),
  );
  expect(document.body.textContent).not.toContain("hidden");
  expect(filterTrigger()?.textContent).toBe("Filter");
});

it("restores a project's runs filters and leaves another project on the defaults", async () => {
  window.localStorage.clear();
  const seen: RunsViewConfig[] = [];

  function Harness({ projectId }: { projectId: string }) {
    const view = useRunsView(projectId);
    seen.push(view.config);
    return (
      <button type="button" onClick={() => view.update({ showDoneIssues: true })}>
        Show done
      </button>
    );
  }

  mounted.push(await mount(<Harness projectId="project-1" />));
  await act(async () => {
    findButton("Show done")?.click();
  });
  const [entry] = mounted.splice(0, 1);
  await entry.cleanup();

  mounted.push(await mount(<Harness projectId="project-1" />));
  expect(seen.at(-1)).toEqual({ showFailed: true, showDoneIssues: true });

  const [reopened] = mounted.splice(0, 1);
  await reopened.cleanup();
  mounted.push(await mount(<Harness projectId="project-2" />));
  expect(seen.at(-1)).toEqual(DEFAULT_RUNS_VIEW_CONFIG);
});
