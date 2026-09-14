// @vitest-environment happy-dom
import type { BreadcrumbItem } from "@otomat/ui";
import { RunCockpitLayout } from "@web/components/runs/cockpit/layout";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { linearIssueContract } from "#support/issue";

interface FakeDetailQuery {
  data: unknown;
}

interface FakeIssueQuery {
  isPending: boolean;
  isError?: boolean;
  data: unknown;
}

let detail: FakeDetailQuery;
let issue: FakeIssueQuery;
let publication: { pull_request: { url: string; number: number } } | undefined;

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>outlet</div>,
  useParams: () => ({ runId: "run-1" }),
  useSearch: () => ({ step: "step-2" }),
  useRouterState: () => "/runs/run-1",
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => detail,
}));

vi.mock("@web/api/prs/queries", () => ({
  useRunPullRequest: () => ({ data: publication }),
}));

vi.mock("@web/components/runs/next-action/strip", () => ({
  NextActionStrip: () => <div>next action</div>,
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => issue,
}));

vi.mock("@web/api/runs/run-events-provider", () => ({
  RunEventsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@web/components/runs/cockpit/tabs", () => ({
  CockpitTabs: () => <div>tabs</div>,
}));

vi.mock("@web/components/shell/use-back-navigation", () => ({
  useBackNavigation: () => null,
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({
    active,
    breadcrumbs,
    breadcrumbExtra,
    banner,
    actions,
    children,
  }: {
    active: string;
    breadcrumbs: BreadcrumbItem[];
    breadcrumbExtra: ReactNode;
    banner: ReactNode;
    actions: ReactNode;
    children: ReactNode;
  }) => (
    <div data-active-section={active}>
      <ol data-crumbs>
        {breadcrumbs.map((item) => (
          <li key={item.label} data-href={item.href ?? ""}>
            {item.label}
          </li>
        ))}
      </ol>
      {breadcrumbExtra}
      {banner}
      {actions}
      {children}
    </div>
  ),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function render() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RunCockpitLayout />);
  });
  return {
    crumbs: [...container.querySelectorAll("[data-crumbs] li")].map((li) => ({
      label: li.textContent,
      href: li.getAttribute("data-href"),
    })),
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("RunCockpitLayout", () => {
  beforeEach(() => {
    publication = undefined;
    detail = { data: { run: { issue_id: "issue-1", status: "completed" } } };
    issue = {
      isPending: false,
      data: linearIssueContract({
        id: "issue-1",
        source_identifier: "OTO-57",
        title: "Readable cockpit",
      }),
    };
  });

  it("opens the published PR directly from the shared run header", async () => {
    publication = { pull_request: { url: "https://github.com/example/repo/pull/42", number: 42 } };
    const view = await render();
    const link = view.container.querySelector('a[href="https://github.com/example/repo/pull/42"]');
    expect(link?.getAttribute("aria-label")).toBe("Open PR #42 on GitHub");
    expect(link?.getAttribute("target")).toBe("_blank");
    await view.cleanup();
  });

  it("activates the Runs section for run routes", async () => {
    const view = await render();
    expect(
      view.container.querySelector("[data-active-section]")?.getAttribute("data-active-section"),
    ).toBe("runs");
    await view.cleanup();
  });

  it("mounts the next-action strip once the run detail is loaded", async () => {
    const view = await render();
    expect(view.container.textContent).toContain("next action");
    await view.cleanup();
  });

  it("mounts no next-action strip before the run detail has loaded", async () => {
    detail = { data: undefined };
    const view = await render();
    expect(view.container.textContent).not.toContain("next action");
    await view.cleanup();
  });

  it("names the linked issue by key and title, and links back to it", async () => {
    const view = await render();
    const crumb = view.crumbs.find((item) => item.label?.includes("OTO-57"));
    expect(crumb?.label).toBe("OTO-57 · Readable cockpit");
    expect(crumb?.href).toBe("/issues/issue-1?run=run-1&step=step-2");
    await view.cleanup();
  });

  it("keeps the technical run id reachable beside the issue", async () => {
    const view = await render();
    expect(view.container.textContent).toContain("run-1");
    expect(view.container.querySelector('[aria-label="Copy run id"]')).not.toBeNull();
    await view.cleanup();
  });

  it("says Unlinked rather than falling back to a run id when the run has no issue", async () => {
    detail = { data: { run: { issue_id: null, status: "completed" } } };
    issue = { isPending: false, data: undefined };
    const view = await render();
    expect(view.crumbs.map((item) => item.label)).toContain("Unlinked");
    await view.cleanup();
  });

  it("does not call a run unlinked before its own detail has loaded", async () => {
    detail = { data: undefined };
    const view = await render();
    expect(view.crumbs.map((item) => item.label)).not.toContain("Unlinked");
    await view.cleanup();
  });

  it("keeps the way back to a linked issue whose fetch failed, and never calls it unlinked", async () => {
    issue = { isPending: false, isError: true, data: undefined };
    const view = await render();
    const labels = view.crumbs.map((item) => item.label);

    expect(labels).not.toContain("Unlinked");
    expect(labels).toContain("Issue unavailable");
    expect(view.crumbs.find((item) => item.label === "Issue unavailable")?.href).toBe(
      "/issues/issue-1?run=run-1&step=step-2",
    );
    await view.cleanup();
  });

  it("states a linked issue is still loading rather than calling it unlinked", async () => {
    issue = { isPending: true, data: undefined };
    const view = await render();
    expect(view.crumbs.map((item) => item.label)).toContain("Loading issue…");
    await view.cleanup();
  });
});
