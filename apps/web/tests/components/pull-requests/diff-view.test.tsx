// @vitest-environment happy-dom
import type { PullRequestContract } from "@otomat/domain";
import type { BreadcrumbItem } from "@otomat/ui";
import { PullRequestDiffView } from "@web/components/pull-requests/diff-view";
import type { ReviewDiffViewProps } from "@web/components/runs/diff/review-view";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount } from "#support/mount";

interface FakePullRequestQuery {
  data: PullRequestContract | undefined;
  isError: boolean;
}

type ReviewedProps = Pick<ReviewDiffViewProps, "target" | "workspace">;

let query: FakePullRequestQuery;
let reviewed: ReviewedProps | null = null;

function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr-1",
    issue_id: null,
    run_id: null,
    provider: "github",
    origin: "imported",
    provenance: "external",
    author_login: "contrib",
    review_decision: null,
    checks_state: "none",
    mergeable: "mergeable",
    requested_reviewers: [],
    provider_updated_at: null,
    head_sha: "a1b2c3d4",
    attachment: null,
    number: 142,
    url: "https://github.com/alimtunc/otomat/pull/142",
    status: "open",
    publication_status: "created",
    title: "Vendor anti-slop",
    body: null,
    head_ref: "contrib/fix",
    base_ref: "main",
    commit_subject: null,
    commit_body: null,
    generator: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    ...overrides,
  };
}

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pullRequestId: "pr-1" }),
}));

vi.mock("@web/api/prs/queries", () => ({
  useAttachedPullRequest: () => query,
}));

vi.mock("@web/api/prs/mutations", () => ({
  useRefreshPullRequest: () => ({ isPending: false, mutate: vi.fn() }),
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
    children,
  }: {
    active: string;
    back: { label: string } | null;
    breadcrumbs: BreadcrumbItem[];
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
  };
}

beforeEach(() => {
  query = { data: pullRequest(), isError: false };
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
    query = { data: pullRequest({ issue_id: "issue-1" }), isError: false };
    await render();

    expect(reviewed).toEqual({
      target: { kind: "pull_request", id: "pr-1" },
      workspace: { open: false, issueId: "issue-1" },
    });
  });

  it("never names a pull request it has not read", async () => {
    query = { data: undefined, isError: false };
    const loading = await render();
    expect(loading.crumbs[1]?.label).toBe("Loading pull request…");

    query = { data: undefined, isError: true };
    const failed = await render();
    expect(failed.crumbs[1]?.label).toBe("Pull request unavailable");
    expect(failed.container.textContent).toContain("Could not load this pull request");
  });

  it("keeps the shell around a pull request whose head was never fetched", async () => {
    query = { data: pullRequest({ head_sha: null }), isError: false };
    const view = await render();

    expect(view.container.querySelector('[data-testid="reviewer"]')).toBeNull();
    expect(view.container.textContent).toContain("No fetched head");
    expect(view.crumbs[0]?.href).toBe("/reviews");
  });
});
