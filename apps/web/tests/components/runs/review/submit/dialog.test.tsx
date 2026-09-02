// @vitest-environment happy-dom
import type { SubmitReviewRequest } from "@otomat/domain";
import { SubmitReviewDialog } from "@web/components/runs/review/submit/dialog";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { setTextareaValue } from "#support/dom-events";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { reviewComment } from "#support/review-comment";
import { reviewDetail } from "#support/review-detail";
import { reviewedFile } from "#support/reviewed-file";

const submitted: SubmitReviewRequest[] = [];
let refusal: Error | null = null;

vi.mock("@web/api/reviews/mutations", () => ({
  useSubmitReview: () => ({
    isPending: false,
    mutate: (request: SubmitReviewRequest, options?: { onSuccess: () => void }) => {
      submitted.push(request);
      if (refusal === null) options?.onSuccess();
    },
  }),
}));

const TARGET = { kind: "pull_request", id: "pr-1" } as const;

const OPEN_DETAIL = reviewDetail([reviewedFile({ file_path: "a.ts", reviewed: true })], {
  comments: [reviewComment({ id: "c1", destination: "pr_review", publication_status: "local" })],
  destinations: { pr_review: true, reason: "Pull request #7 is open for review." },
  submission: { events: ["comment", "request_changes"], reason: "You opened this pull request." },
});

async function openDialog(detail = OPEN_DETAIL) {
  submitted.length = 0;
  refusal = null;
  const mounted = await mount(<SubmitReviewDialog target={TARGET} detail={detail} />);
  await act(async () => {
    findButton("Submit review")?.click();
  });
  return mounted;
}

function summary(): HTMLTextAreaElement {
  const field = document.body.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Review summary"]',
  );
  if (field === null) throw new Error("no summary field rendered");
  return field;
}

it("counts the reviewed files and the comments the submission will carry", async () => {
  const mounted = await openDialog();
  expect(document.body.textContent).toContain("1 file reviewed · 1 comment included");
  await mounted.cleanup();
});

it("offers only the verdicts the daemon allows, and says why the rest are withheld", async () => {
  const mounted = await openDialog();
  expect(findButton("Comment")).toBeDefined();
  expect(findButton("Request changes")).toBeDefined();
  expect(findButton("Approve")).toBeUndefined();
  expect(document.body.textContent).toContain("You opened this pull request.");
  await mounted.cleanup();
});

it("submits the summary with the chosen verdict", async () => {
  const mounted = await openDialog();
  await act(async () => {
    setTextareaValue(summary(), "Two notes below.");
  });
  await act(async () => {
    findButton("Request changes")?.click();
  });
  await act(async () => {
    findButton("Submit to GitHub")?.click();
  });

  expect(submitted).toEqual([{ body: "Two notes below.", event: "request_changes" }]);
  await mounted.cleanup();
});

it("keeps the composer open with its text when GitHub refuses the submission", async () => {
  const mounted = await openDialog();
  refusal = new Error("GitHub refused the review.");
  await act(async () => {
    setTextareaValue(summary(), "Kept on refusal.");
  });
  await act(async () => {
    findButton("Submit to GitHub")?.click();
  });

  expect(submitted).toHaveLength(1);
  expect(summary().value).toBe("Kept on refusal.");
  await mounted.cleanup();
});

it("refuses to open on a surface the daemon offers no verdict for", async () => {
  const mounted = await mount(<SubmitReviewDialog target={TARGET} detail={reviewDetail()} />);
  expect(findButton("Submit review")?.disabled).toBe(true);
  await mounted.cleanup();
});

it("refuses an empty submission from the first paint, not after a dead click", async () => {
  const empty = reviewDetail([], {
    comments: [],
    destinations: { pr_review: true, reason: "Pull request #7 is open for review." },
    submission: { events: ["comment"], reason: "Pull request #7 is open for review." },
  });
  const mounted = await openDialog(empty);

  expect(findButton("Submit to GitHub")?.disabled).toBe(true);
  await mounted.cleanup();
});
