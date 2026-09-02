// @vitest-environment happy-dom
import type {
  ReviewCommentContract,
  ReviewDetail,
  ReviewFixAuthority,
  ReviewTarget,
} from "@otomat/domain";
import { DiffFixBar } from "@web/components/runs/diff/fix-bar";
import { describe, expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { reviewComment } from "#support/review-comment";
import { reviewDetail } from "#support/review-detail";

vi.mock("@web/components/runs/review/fix-step-dialog", () => ({
  ReviewFixStepDialog: ({ count, disabled }: { count: number; disabled: boolean }) => (
    <button type="button" disabled={disabled}>{`eligible:${count}`}</button>
  ),
}));

vi.mock("@web/components/runs/review/submit/dialog", () => ({
  SubmitReviewDialog: () => <button type="button">Submit review</button>,
}));

const OTOMAT: ReviewFixAuthority = { kind: "otomat", reason: "Otomat owns otomat/run/r1 here." };
const EXTERNAL: ReviewFixAuthority = {
  kind: "external",
  reason: "@contrib owns contrib/fix. Otomat reviews it here; it never rewrites it.",
};

const REVIEWABLE = {
  destinations: { pr_review: true, reason: "Pull request #7 is open for review." },
  submission: {
    events: ["comment"],
    reason: "Pull request #7 is open for review.",
  } satisfies ReviewDetail["submission"],
};

function bar(
  comments: ReviewCommentContract[],
  authority = OTOMAT,
  workspaceOpen = true,
  target: ReviewTarget = { kind: "run", id: "r1" },
  reviewable = false,
) {
  const review = reviewDetail([], { comments, fix_authority: authority });
  if (reviewable) {
    review.destinations = REVIEWABLE.destinations;
    review.submission = REVIEWABLE.submission;
  }
  return mount(
    <DiffFixBar target={target} workspaceOpen={workspaceOpen} issueId="i1" review={review} />,
  );
}

describe("diff fix bar", () => {
  it("counts every open agent comment and no other", async () => {
    const { cleanup } = await bar([
      reviewComment({ id: "c1" }),
      reviewComment({ id: "c2" }),
      reviewComment({ id: "c3", destination: "pr_review" }),
      reviewComment({ id: "c4", status: "addressed" }),
      reviewComment({ id: "c5", status: "outdated" }),
      reviewComment({ id: "c6", fix_requested_at: "2026-08-22T00:00:00.000Z" }),
    ]);

    expect(findButton("eligible:2")).toBeDefined();
    await cleanup();
  });

  it("offers no fix and says why when nothing is addressed to the agent", async () => {
    const { container, cleanup } = await bar([reviewComment({ destination: "pr_review" })]);

    expect(findButton("eligible:0")?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Address a comment to the agent");
    await cleanup();
  });

  it("keeps a closed workspace's reason over the eligible count", async () => {
    const { container, cleanup } = await bar([reviewComment()], OTOMAT, false);

    expect(findButton("eligible:1")?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("workspace is still open");
    await cleanup();
  });

  it("states the authority's own reason and hides the fix on a branch Otomat does not own", async () => {
    const { container, cleanup } = await bar([reviewComment()], EXTERNAL);

    expect(container.textContent).toContain("Review only");
    expect(container.textContent).toContain("@contrib owns contrib/fix");
    expect(findButton("eligible:1")).toBeUndefined();
    await cleanup();
  });

  it("offers the submit composer on a run whose review reaches a pull request", async () => {
    const { cleanup } = await bar([], OTOMAT, true, { kind: "run", id: "r1" }, true);

    expect(findButton("Submit review")).toBeDefined();
    await cleanup();
  });

  it("leaves the submit composer to the reviewer header on a pull request surface", async () => {
    const { cleanup } = await bar([], OTOMAT, true, { kind: "pull_request", id: "pr-1" }, true);

    expect(findButton("Submit review")).toBeUndefined();
    await cleanup();
  });
});
