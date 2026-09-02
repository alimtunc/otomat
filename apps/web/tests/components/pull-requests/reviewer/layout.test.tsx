// @vitest-environment happy-dom
import type { PullRequestReviewContext } from "@otomat/domain";
import type { BreadcrumbItem } from "@otomat/ui";
import { PullRequestReviewerLayout } from "@web/components/pull-requests/reviewer/layout";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";
import { pullRequestReviewContext } from "#support/pull-request";

interface FakePullRequestQuery {
  data: PullRequestReviewContext | undefined;
  isError: boolean;
  dataUpdatedAt: number;
}

let query: FakePullRequestQuery;

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pullRequestId: "pr-1" }),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  Outlet: () => <div data-testid="tab-body" />,
}));

vi.mock("@web/api/prs/queries", () => ({
  usePullRequestReviewContext: () => query,
}));

vi.mock("@web/components/pull-requests/reviewer/actions", () => ({
  PullRequestReviewerActions: ({ url }: { url: string | null }) => (
    <a href={url ?? undefined}>Open on GitHub</a>
  ),
}));

vi.mock("@web/components/pull-requests/reviewer/tabs", () => ({
  PullRequestReviewerTabs: () => <div data-testid="tabs" />,
}));

vi.mock("@web/components/shell/use-back-navigation", () => ({
  useBackNavigation: () => ({ label: "back-stub", goBack: vi.fn() }),
}));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({
    active,
    back,
    breadcrumbs,
    breadcrumbExtra,
    tabs,
    actions,
    children,
  }: {
    active: string;
    back: { label: string } | null;
    breadcrumbs: BreadcrumbItem[];
    breadcrumbExtra: ReactNode;
    tabs: ReactNode;
    actions: ReactNode;
    children: ReactNode;
  }) => (
    <div data-active-section={active}>
      {back === null ? null : <button type="button" aria-label={back.label} />}
      <ol data-crumbs>
        {breadcrumbs.map((item) => (
          <li key={item.label} data-href={item.href ?? ""}>
            {item.label}
          </li>
        ))}
      </ol>
      <div data-context>{breadcrumbExtra}</div>
      <div data-tabs>{tabs}</div>
      <div data-actions>{actions}</div>
      {children}
    </div>
  ),
}));

const mounted: Array<() => Promise<void>> = [];

async function render() {
  const { container, cleanup } = await mount(<PullRequestReviewerLayout />);
  mounted.push(cleanup);
  return {
    container,
    crumbs: [...container.querySelectorAll("[data-crumbs] li")].map((li) => ({
      label: li.textContent,
      href: li.getAttribute("data-href"),
    })),
    context: container.querySelector("[data-context]")?.textContent ?? "",
  };
}

beforeEach(() => {
  query = { data: pullRequestReviewContext(), isError: false, dataUpdatedAt: 0 };
});

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
});

describe("PullRequestReviewerLayout", () => {
  it("holds both tabs inside the Otomat shell, under the Reviews section", async () => {
    const view = await render();

    expect(
      view.container.querySelector("[data-active-section]")?.getAttribute("data-active-section"),
    ).toBe("reviews");
    expect(view.container.querySelector('[data-testid="tabs"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="tab-body"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-label="back-stub"]')).not.toBeNull();
  });

  it("keeps Open on GitHub in the header of every tab", async () => {
    const view = await render();

    const link = view.container.querySelector("[data-actions] a");
    expect(link?.textContent).toBe("Open on GitHub");
    expect(link?.getAttribute("href")).toBe("https://github.com/alimtunc/otomat/pull/142");
  });

  it("names the pull request under Reviews and links the way back", async () => {
    const view = await render();

    expect(view.crumbs).toEqual([
      { label: "Reviews", href: "/reviews" },
      { label: "alimtunc/otomat#142", href: "" },
    ]);
  });

  it("never names a pull request it has not read", async () => {
    query = { data: undefined, isError: false, dataUpdatedAt: 0 };
    expect((await render()).crumbs[1]?.label).toBe("Loading pull request…");

    query = { data: undefined, isError: true, dataUpdatedAt: 0 };
    expect((await render()).crumbs[1]?.label).toBe("Pull request unavailable");
  });

  it("names the issue a reference resolves, without claiming Otomat owns it", async () => {
    query = {
      data: pullRequestReviewContext(
        {},
        {
          id: "issue-1",
          identifier: "OTO-125",
          title: "Stabilise the reviewer",
          status: "running",
          evidence: "reference",
        },
      ),
      isError: false,
      dataUpdatedAt: 0,
    };
    const view = await render();

    expect(view.context).toContain("OTO-125");
    expect(view.context).toContain("Referenced");
  });

  it("says an attached pull request is held by a workspace here", async () => {
    query = {
      data: pullRequestReviewContext(
        { issue_id: "issue-1" },
        {
          id: "issue-1",
          identifier: "OTO-125",
          title: "Stabilise the reviewer",
          status: "running",
          evidence: "attachment",
        },
      ),
      isError: false,
      dataUpdatedAt: 0,
    };

    expect((await render()).context).toContain("Attached");
  });

  it("stays honest when no issue could be resolved", async () => {
    expect((await render()).context).toBe("No linked issue");
  });
});
