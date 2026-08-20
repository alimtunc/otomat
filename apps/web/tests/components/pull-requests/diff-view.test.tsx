// @vitest-environment happy-dom
import type { PullRequestReviewContext } from "@otomat/domain";
import type { BreadcrumbItem } from "@otomat/ui";
import { PullRequestDiffView } from "@web/components/pull-requests/diff-view";
import type { ReviewDiffViewProps } from "@web/components/runs/diff/review-view";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";
import { pullRequestReviewContext } from "#support/pull-request";

interface FakePullRequestQuery {
  data: PullRequestReviewContext | undefined;
  isError: boolean;
  dataUpdatedAt: number;
}

type ReviewedProps = Pick<ReviewDiffViewProps, "target" | "workspace">;

let query: FakePullRequestQuery;
let reviewed: ReviewedProps | null = null;

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pullRequestId: "pr-1" }),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/api/prs/queries", () => ({
  usePullRequestReviewContext: () => query,
}));

vi.mock("@web/api/prs/use-reconciliation", () => ({
  usePullRequestReconciliation: () => ({ running: false, failure: null, retry: vi.fn() }),
}));

vi.mock("@web/components/runs/diff/review-view", () => ({
  ReviewDiffView: ({ target, workspace }: ReviewedProps) => {
    reviewed = { target, workspace };
    return <div data-testid="reviewer" />;
  },
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
    children,
  }: {
    active: string;
    back: { label: string } | null;
    breadcrumbs: BreadcrumbItem[];
    breadcrumbExtra: ReactNode;
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
      {children}
    </div>
  ),
}));

const mounted: Array<() => Promise<void>> = [];

async function render() {
  const { container, cleanup } = await mount(<PullRequestDiffView />);
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
  reviewed = null;
});

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
});

describe("PullRequestDiffView", () => {
  it("reviews inside the Otomat shell, under the Reviews section", async () => {
    const view = await render();

    expect(
      view.container.querySelector("[data-active-section]")?.getAttribute("data-active-section"),
    ).toBe("reviews");
    expect(view.container.querySelector('[data-testid="reviewer"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-label="back-stub"]')).not.toBeNull();
  });

  it("names the pull request between Reviews and the diff, and links the way back", async () => {
    const view = await render();

    expect(view.crumbs).toEqual([
      { label: "Reviews", href: "/reviews" },
      { label: "alimtunc/otomat#142", href: "" },
      { label: "Diff", href: "" },
    ]);
  });

  it("reviews the pull request it read, against a workspace it never holds", async () => {
    query = {
      data: pullRequestReviewContext({ issue_id: "issue-1" }),
      isError: false,
      dataUpdatedAt: 0,
    };
    await render();

    expect(reviewed).toEqual({
      target: { kind: "pull_request", id: "pr-1" },
      workspace: { open: false, issueId: "issue-1" },
    });
  });

  it("never names a pull request it has not read", async () => {
    query = { data: undefined, isError: false, dataUpdatedAt: 0 };
    const loading = await render();
    expect(loading.crumbs[1]?.label).toBe("Loading pull request…");

    query = { data: undefined, isError: true, dataUpdatedAt: 0 };
    const failed = await render();
    expect(failed.crumbs[1]?.label).toBe("Pull request unavailable");
    expect(failed.container.textContent).toContain("Could not load this pull request");
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
    expect(view.context).toContain("Stabilise the reviewer");
    expect(view.context).toContain("Referenced");
    expect(reviewed?.workspace).toEqual({ open: false, issueId: null });
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
    const view = await render();

    expect(view.context).toContain("Attached");
  });

  it("stays reviewable and honest when no issue could be resolved", async () => {
    const view = await render();

    expect(view.context).toBe("No linked issue");
    expect(view.container.querySelector('[data-testid="reviewer"]')).not.toBeNull();
  });

  it("keeps the shell around a pull request whose head was never fetched", async () => {
    query = {
      data: pullRequestReviewContext({ head_sha: null }),
      isError: false,
      dataUpdatedAt: 0,
    };
    const view = await render();

    expect(view.container.querySelector('[data-testid="reviewer"]')).toBeNull();
    expect(view.container.textContent).toContain("No fetched head");
    expect(view.crumbs[0]?.href).toBe("/reviews");
  });
});
