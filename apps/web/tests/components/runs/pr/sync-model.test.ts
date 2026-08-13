import type { PullRequestSync } from "@otomat/domain";
import { pullRequestSyncModel } from "@web/components/runs/pr/sync/model";
import { describe, expect, it } from "vitest";

function sync(overrides: Partial<PullRequestSync> = {}): PullRequestSync {
  return {
    state: "in_sync",
    dirty: false,
    local_head_sha: "a".repeat(40),
    remote_head_sha: "a".repeat(40),
    ahead: [],
    replaced: [],
    ...overrides,
  };
}

describe("pullRequestSyncModel", () => {
  it("says the pull request is up to date only when nothing is left behind", () => {
    expect(pullRequestSyncModel(sync())).toMatchObject({
      stateLabel: "Pull request up to date",
      tone: "success",
      pushDisabled: true,
      forceExpectedSha: null,
    });
  });

  it("names uncommitted work as uncommitted, and never as pushable", () => {
    const model = pullRequestSyncModel(sync({ dirty: true }));

    expect(model).toMatchObject({ stateLabel: "Uncommitted changes", pushDisabled: true });
    expect(model.description).toContain("commit them in the run first");
  });

  it("offers a push for local commits, and still flags uncommitted work beside them", () => {
    const model = pullRequestSyncModel(
      sync({
        state: "ahead",
        dirty: true,
        ahead: [{ sha: "b".repeat(40), subject: "follow up" }],
      }),
    );

    expect(model).toMatchObject({
      stateLabel: "1 commit to push",
      pushDisabled: false,
      forceExpectedSha: null,
    });
    expect(model.description).toContain("Uncommitted changes");
  });

  it("offers a lease instead of a plain push when the branch diverged", () => {
    const model = pullRequestSyncModel(
      sync({
        state: "diverged",
        remote_head_sha: "c".repeat(40),
        ahead: [{ sha: "b".repeat(40), subject: "follow up" }],
        replaced: [{ sha: "c".repeat(40), subject: "someone else" }],
      }),
    );

    expect(model).toMatchObject({
      stateLabel: "Remote branch diverged",
      tone: "danger",
      pushDisabled: true,
      forceExpectedSha: "c".repeat(40),
    });
    expect(model.description).toContain("force push with lease");
  });

  it("admits an unavailable comparison instead of implying the pull request is current", () => {
    const model = pullRequestSyncModel(
      sync({ state: "unavailable", local_head_sha: null, remote_head_sha: null }),
    );

    expect(model).toMatchObject({
      stateLabel: "Comparison unavailable",
      pushDisabled: true,
      forceExpectedSha: null,
    });
  });
});
