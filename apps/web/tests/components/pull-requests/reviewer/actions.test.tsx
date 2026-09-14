// @vitest-environment happy-dom
import type { PullRequestReviewContext } from "@otomat/domain";
import { PullRequestReviewerActions } from "@web/components/pull-requests/reviewer/actions";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

import { mount } from "#support/mount";
import { pullRequestReviewContext } from "#support/pull-request";

let context: PullRequestReviewContext;

vi.mock("@tanstack/react-router", () => ({
  useMatchRoute: () => () => true,
  Link: ({ params, children }: { params: { runId: string }; children: ReactNode }) => (
    <a href={`/runs/${params.runId}`}>{children}</a>
  ),
}));
vi.mock("@web/api/prs/queries", () => ({ usePullRequestReviewContext: () => ({ data: context }) }));
vi.mock("@web/api/reviews/queries", () => ({ useReviewDetail: () => ({ data: undefined }) }));

it.each(["attachment", "reference", null] as const)(
  "offers the cockpit only for a canonical attachment, evidence: %s",
  async (evidence) => {
    context = pullRequestReviewContext(
      { run_id: "run-1" },
      evidence === null
        ? null
        : { id: "issue-1", identifier: "OTO-1", title: "Issue", status: "ready", evidence },
    );
    const view = await mount(
      <PullRequestReviewerActions pullRequestId="pr-1" url={context.pull_request.url} />,
    );
    try {
      expect(view.container.querySelector('a[href="/runs/run-1"]') !== null).toBe(
        evidence === "attachment",
      );
      expect(
        view.container
          .querySelector(`a[href="${context.pull_request.url}"]`)
          ?.getAttribute("target"),
      ).toBe("_blank");
      expect(
        view.container.querySelector(`a[href="${context.pull_request.url}"]`)?.getAttribute("role"),
      ).toBe("link");
    } finally {
      await view.cleanup();
    }
  },
);
