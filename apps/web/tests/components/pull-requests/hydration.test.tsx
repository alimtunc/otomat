// @vitest-environment happy-dom
import { DaemonRequestError } from "@otomat/client";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { PullRequestDiffView } from "@web/components/pull-requests/diff-view";
import { act, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mount, type Mounted } from "#support/mount";
import { pullRequestReviewContext } from "#support/pull-request";
import { testQueryClient, withQueryClient } from "#support/query";

const { getContext, refresh } = vi.hoisted(() => ({ getContext: vi.fn(), refresh: vi.fn() }));

vi.mock("@web/api/client", () => ({
  daemon: {
    getPullRequestReviewContext: (id: string) => getContext(id),
    refreshPullRequest: (id: string) => refresh(id),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pullRequestId: "pr-1" }),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@web/components/shell/use-back-navigation", () => ({ useBackNavigation: () => null }));

vi.mock("@web/components/shell/route-shell", () => ({
  RouteShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@web/components/runs/diff/review-view", () => ({
  ReviewDiffView: () => <div data-testid="reviewer" />,
}));

const refusal = (message: string) =>
  new DaemonRequestError(409, "POST", "/api/pull-requests/pr-1/refresh", {
    error: "pr_lookup_failed",
    message,
  });

let client: QueryClient;
let rendered: Mounted | null = null;

async function render() {
  rendered = await mount(withQueryClient(<PullRequestDiffView />, client));
  return rendered;
}

async function settle(): Promise<void> {
  for (let tick = 0; tick < 3; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  client = testQueryClient();
  getContext.mockReset();
  refresh.mockReset();
  getContext.mockReturnValue(new Promise(() => {}));
  refresh.mockResolvedValue(pullRequestReviewContext());
});

afterEach(async () => {
  await rendered?.cleanup();
  rendered = null;
  document.body.replaceChildren();
});

describe("arriving on a pull request", () => {
  it("renders what the cache already holds instead of a loader", async () => {
    client.setQueryData(queryKeys.pullRequest("pr-1"), pullRequestReviewContext());

    const view = await render();

    expect(view.container.querySelector('[data-testid="reviewer"]')).not.toBeNull();
  });

  it("reads it once and reconciles it once, with no refresh to click", async () => {
    getContext.mockResolvedValue(pullRequestReviewContext());

    const view = await render();
    await settle();

    expect(getContext).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).not.toContain("Fetch from GitHub");
  });

  it("fetches an unfetched head itself rather than waiting for the operator", async () => {
    getContext.mockResolvedValue(pullRequestReviewContext({ head_sha: null }));
    refresh.mockResolvedValue(pullRequestReviewContext({ head_sha: "fetched-sha" }));

    const view = await render();
    await settle();

    expect(refresh).toHaveBeenCalledWith("pr-1");
    expect(view.container.querySelector('[data-testid="reviewer"]')).not.toBeNull();
  });

  it("keeps the reviewer on screen when the reconciliation fails, and says why", async () => {
    getContext.mockResolvedValue(pullRequestReviewContext());
    refresh.mockRejectedValue(refusal("The pull request head could not be fetched."));

    const view = await render();
    await settle();

    expect(view.container.querySelector('[data-testid="reviewer"]')).not.toBeNull();
    expect(view.container.textContent).toContain("The pull request head could not be fetched.");
    expect(view.container.textContent).toContain("Retry");
  });

  it("never lets an answer for another pull request land on this one", async () => {
    getContext.mockResolvedValue(pullRequestReviewContext());
    refresh.mockResolvedValue(pullRequestReviewContext({ id: "pr-2", title: "Someone else's" }));

    await render();
    await settle();

    expect(client.getQueryData(queryKeys.pullRequest("pr-1"))).toEqual(pullRequestReviewContext());
    expect(client.getQueryData(queryKeys.pullRequest("pr-2"))).not.toBeUndefined();
  });
});
