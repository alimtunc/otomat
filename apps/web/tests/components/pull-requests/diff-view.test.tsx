// @vitest-environment happy-dom
import type { PullRequestReviewContext } from "@otomat/domain";
import { PullRequestDiffView } from "@web/components/pull-requests/diff-view";
import type { ReviewDiffViewProps } from "@web/components/runs/diff/review-view";
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

vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ pullRequestId: "pr-1" }) }));

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

const mounted: Array<() => Promise<void>> = [];

async function render() {
  const { container, cleanup } = await mount(<PullRequestDiffView />);
  mounted.push(cleanup);
  return container;
}

beforeEach(() => {
  query = { data: pullRequestReviewContext(), isError: false, dataUpdatedAt: 0 };
  reviewed = null;
});

afterEach(async () => {
  for (const cleanup of mounted.splice(0)) await cleanup();
});

describe("PullRequestDiffView", () => {
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

  it("reports a pull request it could not read instead of rendering a reviewer", async () => {
    query = { data: undefined, isError: true, dataUpdatedAt: 0 };
    const container = await render();

    expect(container.textContent).toContain("Could not load this pull request");
    expect(container.querySelector('[data-testid="reviewer"]')).toBeNull();
  });

  it("offers to fetch a head Otomat never fetched, rather than an empty diff", async () => {
    query = {
      data: pullRequestReviewContext({ head_sha: null }),
      isError: false,
      dataUpdatedAt: 0,
    };
    const container = await render();

    expect(container.querySelector('[data-testid="reviewer"]')).toBeNull();
    expect(container.textContent).toContain("No fetched head");
  });
});
