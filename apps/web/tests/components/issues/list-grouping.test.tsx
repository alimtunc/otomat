// @vitest-environment happy-dom
import { IssuesBoard } from "@web/components/issues/list/board";
import { IssuesTable } from "@web/components/issues/list/table";
import { groupIssues } from "@web/lib/issue/grouping";
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { issueContract, linearIssueContract, openWorkspace } from "#support/issue";
import { type Mounted } from "#support/mount";
import { mountRouted } from "#support/router";

const mounted: Mounted[] = [];

const READY = linearIssueContract({ id: "a", title: "Ready one", status: "ready" });
const BACKLOG = issueContract({ id: "b", title: "Backlog one", status: "backlog" });
const GROUPS = groupIssues([READY, BACKLOG], "status", new Map());

afterEach(async () => {
  for (const entry of mounted.splice(0)) await entry.cleanup();
  document.body.replaceChildren();
});

async function render(node: Parameters<typeof mountRouted>[0]): Promise<HTMLElement> {
  const rendered = await mountRouted(node);
  mounted.push(rendered);
  return rendered.container;
}

function headers(container: HTMLElement): string[] {
  return [...container.querySelectorAll("button[aria-expanded]")].map(
    (button) => button.textContent?.trim() ?? "",
  );
}

it("gives the list a header per group, in state-machine order, with its count", async () => {
  const container = await render(
    <IssuesTable groups={GROUPS} showGroupHeadings collapsed={[]} onToggleGroup={vi.fn()} />,
  );
  expect(headers(container)).toEqual(["Backlog1", "Ready1"]);
  expect(container.querySelectorAll("tbody tr td")).not.toHaveLength(0);
});

it("keeps the list flat when the view groups by nothing", async () => {
  const container = await render(
    <IssuesTable
      groups={groupIssues([READY, BACKLOG], "none", new Map())}
      showGroupHeadings={false}
      collapsed={[]}
      onToggleGroup={vi.fn()}
    />,
  );
  expect(headers(container)).toEqual([]);
  expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
});

it("folds a collapsed group away without dropping its header or its count", async () => {
  const onToggleGroup = vi.fn();
  const container = await render(
    <IssuesTable
      groups={GROUPS}
      showGroupHeadings
      collapsed={["status:backlog"]}
      onToggleGroup={onToggleGroup}
    />,
  );
  const [backlog] = [...container.querySelectorAll("button[aria-expanded]")];
  expect(backlog.getAttribute("aria-expanded")).toBe("false");
  expect(backlog.textContent).toContain("1");
  expect(document.getElementById("issue-group-status:backlog")?.children).toHaveLength(0);
  expect(document.getElementById("issue-group-status:ready")?.children).toHaveLength(1);

  if (!(backlog instanceof HTMLElement)) throw new Error("backlog header is not an element");
  await act(async () => {
    backlog.click();
  });
  expect(onToggleGroup).toHaveBeenCalledWith("status:backlog");
});

it("gives the board one column per group and hides a folded column's cards only", async () => {
  const container = await render(
    <IssuesBoard
      groups={GROUPS}
      showGroupHeadings
      collapsed={["status:ready"]}
      onToggleGroup={vi.fn()}
    />,
  );
  expect(
    [...container.querySelectorAll("section")].map((s) => s.getAttribute("aria-label")),
  ).toEqual(["Backlog", "Ready"]);
  expect(document.getElementById("board-group-status:ready")?.children).toHaveLength(0);
  expect(document.getElementById("board-group-status:backlog")?.children).toHaveLength(1);
});

it("names the stopped cycle only on the card whose column reports it", async () => {
  const stopped = {
    state: "failed",
    run_id: "r1",
    failure: { reason: "failed", step: { id: "s1", name: "Reviewer" } },
  } as const;
  const workspace = openWorkspace("r1", "failed");
  await render(
    <IssuesBoard
      groups={groupIssues(
        [
          issueContract({
            id: "c",
            title: "Shipped",
            status: "done",
            execution: stopped,
            workspace,
          }),
          issueContract({
            id: "d",
            title: "Stopped",
            status: "ready",
            execution: stopped,
            workspace,
          }),
        ],
        "status",
        new Map(),
      )}
      showGroupHeadings
      collapsed={[]}
      onToggleGroup={vi.fn()}
    />,
  );
  expect(document.getElementById("board-group-status:failed")?.textContent).toContain(
    "Failed at Reviewer",
  );
  expect(document.getElementById("board-group-status:done")?.textContent).not.toContain(
    "Failed at Reviewer",
  );
});

it("drops the board's headers too when the view groups by nothing", async () => {
  const container = await render(
    <IssuesBoard
      groups={groupIssues([READY, BACKLOG], "none", new Map())}
      showGroupHeadings={false}
      collapsed={["all"]}
      onToggleGroup={vi.fn()}
    />,
  );
  expect(headers(container)).toEqual([]);
  expect(document.getElementById("board-group-all")?.children).toHaveLength(2);
});
