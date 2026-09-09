// @vitest-environment happy-dom

import type { PullRequestDetail } from "@otomat/domain";
import { RunPrView } from "@web/components/runs/pr/view";
import {
  pullRequestDetailFixture,
  pullRequestFixture,
  runDetailFixture,
} from "@web/gallery/gallery.fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mountRouted } from "#support/router";

const detail = vi.hoisted<{ data: PullRequestDetail | null }>(() => ({ data: null }));
const mocks = vi.hoisted(() => ({
  generate: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, reset: vi.fn() },
  publish: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useParams: () => ({ runId: "run-1" }),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock("@web/api/runs/queries", () => ({
  useRunDetail: () => ({ isPending: false, isError: false, data: runDetailFixture("completed") }),
  useRunCompletionReport: () => ({ isError: false, data: undefined }),
}));

vi.mock("@web/api/prs/queries", () => ({
  useRunPullRequest: () => ({ isPending: false, isError: false, data: detail.data }),
  useGitHubConnection: () => ({ isPending: false, isError: false, data: { status: "connected" } }),
}));

vi.mock("@web/api/prs/mutations", () => ({
  useConnectGitHub: () => ({ mutate: vi.fn(), isPending: false }),
  usePublishPullRequest: () => mocks.publish,
  useGeneratePullRequestMetadata: () => mocks.generate,
}));

vi.mock("@web/api/issues/queries", () => ({
  useIssue: () => ({ data: { title: "Centraliser la prochaine action" } }),
}));

const REFUSAL = "The subject is 79 characters; remove 7 to stay within 72.";

describe("RunPrView", () => {
  beforeEach(() => {
    detail.data = pullRequestDetailFixture(pullRequestFixture({ status: "merged" }));
  });

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

  it("opens the editable details on the refusal a compact publication left on the row", async () => {
    detail.data = pullRequestDetailFixture(
      pullRequestFixture({
        status: "draft",
        number: null,
        url: null,
        publication_status: "failed",
        commit_subject: null,
        error_code: "pr_generation_invalid",
        error_message: REFUSAL,
      }),
    );

    const view = await mountRouted(<RunPrView />);

    const alerts = [...view.container.querySelectorAll('[role="alert"]')].map(
      (node) => node.textContent,
    );
    expect(alerts).toContain(REFUSAL);
    expect(view.container.textContent).not.toContain("PR with AI");
    expect(view.container.querySelectorAll("input").length).toBeGreaterThan(0);
    await view.cleanup();
  });
});
