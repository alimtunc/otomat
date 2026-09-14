// @vitest-environment happy-dom
import type { PullRequestOverview } from "@otomat/domain";
import type { UseQueryResult } from "@tanstack/react-query";
import { PullRequestOverviewView } from "@web/components/pull-requests/overview/view";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";
import { pullRequestOverview } from "#support/pull-request-overview";

let query: Partial<UseQueryResult<PullRequestOverview>> = {};

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pullRequestId: "pr-1" }),
}));

vi.mock("@web/api/prs/queries", () => ({
  usePullRequestOverview: () => query,
}));

vi.mock("@web/components/pull-requests/overview/merge-panel", () => ({
  PullRequestMergePanel: () => null,
}));

function withQuery(result: Partial<UseQueryResult<PullRequestOverview>>) {
  query = { isError: false, isFetching: false, dataUpdatedAt: 0, refetch: () => {}, ...result };
  return mount(<PullRequestOverviewView />);
}

it("lists every check by name with the state GitHub reports", async () => {
  const { container, cleanup } = await withQuery({
    data: pullRequestOverview({
      checks: [
        { name: "build", state: "passing", url: null },
        { name: "e2e", state: "failing", url: "https://ci.example/e2e" },
        { name: "deploy", state: "pending", url: "https://ci.example/deploy" },
      ],
    }),
  });

  expect(container.textContent).not.toContain("build");
  expect(container.textContent).toContain("e2e");
  expect(container.textContent).toContain("deploy");
  await act(async () => {
    findButton("1 passing")?.click();
  });
  expect(container.textContent).toContain("build");
  expect(container.textContent).toContain("e2e");
  expect(container.textContent).toContain("Passing");
  expect(container.textContent).toContain("Failing");
  expect(container.querySelector('a[href="https://ci.example/e2e"]')).not.toBeNull();
  await cleanup();
});

it("says no check ran rather than showing an empty list", async () => {
  const { container, cleanup } = await withQuery({ data: pullRequestOverview({ checks: [] }) });

  expect(container.textContent).toContain("No check ran on this head");
  await cleanup();
});

it("keeps the cached overview behind a stale notice when the refresh fails", async () => {
  const { container, cleanup } = await withQuery({
    data: pullRequestOverview({ checks: [{ name: "build", state: "passing", url: null }] }),
    isError: true,
    error: new Error("gh could not reach GitHub"),
  });

  await act(async () => {
    findButton("1 passing")?.click();
  });
  expect(container.textContent).toContain("build");
  expect(container.textContent).not.toContain("Could not read this pull request from GitHub");
  await cleanup();
});

it("blocks with an error only when no overview was ever read", async () => {
  const { container, cleanup } = await withQuery({
    data: undefined,
    isError: true,
    error: new Error("gh could not reach GitHub"),
  });

  expect(container.textContent).toContain("Could not read this pull request from GitHub");
  await cleanup();
});

it("collapses passing checks on Escape and returns focus to their trigger", async () => {
  const { container, cleanup } = await withQuery({
    data: pullRequestOverview({
      checks: [{ name: "build", state: "passing", url: "https://ci.example/build" }],
    }),
  });
  await act(async () => {
    findButton("1 passing")?.click();
  });
  const link = container.querySelector<HTMLAnchorElement>('a[href="https://ci.example/build"]');
  await act(async () => {
    link?.focus();
    link?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(findButton("1 passing")?.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(findButton("1 passing"));
  await cleanup();
});
