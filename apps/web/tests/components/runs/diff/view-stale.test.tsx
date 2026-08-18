// @vitest-environment happy-dom
import type { ReviewDetail, ReviewDiffResponse } from "@otomat/domain";
import { RunDiffView } from "@web/components/runs/diff/view";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ runId: "run-1" }),
  useSearch: () => ({ file: undefined }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: unknown }) => <a>{children as never}</a>,
}));

vi.mock("@web/components/shell/use-back-navigation", () => ({
  useBackNavigation: () => null,
}));

const DIFF: ReviewDiffResponse = {
  subject_id: "run-1",
  computed_at: "2026-08-12T00:00:00.000Z",
  diff: { base: "base-sha", files: [], additions: 0, deletions: 0, sha: "diff-sha" },
  scope: { kind: "workspace" },
  unavailable: null,
};

const REVIEW: ReviewDetail = {
  review: null,
  comments: [],
  fix_authority: { kind: "otomat", reason: "Otomat owns this branch." },
  destinations: { pr_review: false, reason: "This run has no pull request yet." },
};

const fresh = (data: unknown) => ({
  isPending: false,
  isError: false,
  data,
  dataUpdatedAt: Date.now(),
  isFetching: false,
  refetch: vi.fn(),
});

let diffQuery: Record<string, unknown> = {};
let reviewQuery: Record<string, unknown> = {};

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () =>
    fresh({ holds_workspace: false, run: { issue_id: "issue-1" }, steps: [], sessions: [] }),
  useRunCommits: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));

vi.mock("@web/api/reviews/queries", () => ({
  useReviewDiff: () => diffQuery,
  useReviewDetail: () => reviewQuery,
}));

vi.mock("@web/api/reviews/mutations", () => ({
  useAddReviewComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishReviewComment: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRequestFix: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/components/runs/diff/fix-bar", () => ({ DiffFixBar: () => null }));

it("keeps the loaded diff and review on screen when one refresh fails", async () => {
  diffQuery = fresh(DIFF);
  reviewQuery = {
    isPending: false,
    isError: true,
    data: REVIEW,
    dataUpdatedAt: Date.now(),
    isFetching: false,
    refetch: vi.fn(),
    error: new Error("refresh failed"),
  };

  const { container, cleanup } = await mount(<RunDiffView />);

  expect(container.textContent).toContain("Couldn’t refresh");
  expect(container.textContent).toContain("No changes yet");
  expect(container.textContent).not.toContain("Could not load the diff");
  await cleanup();
});

it("blocks only when the failing query has nothing retained to show", async () => {
  diffQuery = {
    isPending: false,
    isError: true,
    data: undefined,
    refetch: vi.fn(),
    error: new Error("daemon down"),
  };
  reviewQuery = fresh(REVIEW);

  const { container, cleanup } = await mount(<RunDiffView />);

  expect(container.textContent).toContain("Could not load the diff");
  expect(container.textContent).not.toContain("No changes yet");
  await cleanup();
});
