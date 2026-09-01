// @vitest-environment happy-dom

import { RunPrView } from "@web/components/runs/pr/view";
import {
  pullRequestDetailFixture,
  pullRequestFixture,
  runDetailFixture,
} from "@web/gallery/gallery.fixtures";
import { describe, expect, it, vi } from "vitest";

import { mountRouted } from "#support/router";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useParams: () => ({ runId: "run-1" }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ isPending: false, isError: false, data: runDetailFixture("completed") }),
}));

vi.mock("@web/api/prs/queries", () => ({
  useRunPullRequest: () => ({
    isPending: false,
    isError: false,
    data: pullRequestDetailFixture(pullRequestFixture({ status: "merged" })),
  }),
  useGitHubConnection: () => ({ isPending: false, isError: false, data: { status: "connected" } }),
}));

vi.mock("@web/api/prs/mutations", () => {
  const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  return {
    useConnectGitHub: () => idle,
    usePublishPullRequest: () => idle,
    useGeneratePullRequestMetadata: () => idle,
  };
});

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ data: { title: "Centraliser la prochaine action" } }),
}));

describe("RunPrView", () => {
  it("renders the immutable outcome instead of the publication form for a terminal PR", async () => {
    const view = await mountRouted(<RunPrView />);

    expect(view.container.querySelectorAll("input, textarea, select").length).toBe(0);
    expect(view.container.textContent).not.toContain("with AI");
    expect(view.container.textContent).toContain("Open on GitHub");
    for (const control of view.container.querySelectorAll("button, a")) {
      expect(control.hasAttribute("disabled")).toBe(false);
    }
    await view.cleanup();
  });
});
