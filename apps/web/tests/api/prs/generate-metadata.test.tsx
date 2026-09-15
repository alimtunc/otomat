// @vitest-environment happy-dom
import type { PullRequestProposal } from "@otomat/domain";
import { useGeneratePullRequestMetadata } from "@web/api/prs/mutations";
import { useRunPullRequest } from "@web/api/prs/queries";
import { hostKeys } from "@web/api/query-keys";
import { pullRequestDetailFixture } from "@web/gallery/gallery.fixtures";
import { act } from "react";
import { expect, it, vi } from "vitest";

import { mountWithQuery } from "#support/mount";
import { testQueryClient } from "#support/query";

const mocks = vi.hoisted(() => ({ generatePullRequestMetadata: vi.fn(), getPullRequest: vi.fn() }));
vi.mock("@web/api/client", () => ({ daemon: mocks }));

const PROPOSAL: PullRequestProposal = {
  subject: { type: "feat", scope: "pr", summary: "publish in one action" },
  body: "Publishes the run in one click.",
  branch: "feat/compact-pr",
  commit_body: null,
  generator: { runtime: "claude", model: "claude-opus-5", effort: "high" },
};

let received: PullRequestProposal | null = null;

function Probe() {
  useRunPullRequest("run-1");
  const generate = useGeneratePullRequestMetadata("run-1");
  return (
    <button
      type="button"
      data-pending={generate.isPending || undefined}
      onClick={() => {
        void generate.mutateAsync().then((proposal) => {
          received = proposal;
        });
      }}
    >
      generate
    </button>
  );
}

it("settles the generation as soon as the daemon answers, not when the refetch lands", async () => {
  mocks.generatePullRequestMetadata.mockResolvedValue(PROPOSAL);
  mocks.getPullRequest.mockReturnValue(new Promise(() => undefined));
  const client = testQueryClient();
  client.setQueryData(hostKeys("local").runPullRequest("run-1"), pullRequestDetailFixture(null));
  const view = await mountWithQuery(<Probe />, client);
  try {
    const button = view.container.querySelector("button");
    if (!button) throw new Error("no probe button");
    await act(async () => button.click());
    await act(async () => {});

    expect(mocks.generatePullRequestMetadata).toHaveBeenCalledExactlyOnceWith("run-1");
    expect(received).toEqual(PROPOSAL);
    expect(button.dataset.pending).toBeUndefined();
    expect(mocks.getPullRequest).toHaveBeenCalled();
  } finally {
    await view.cleanup();
  }
});
