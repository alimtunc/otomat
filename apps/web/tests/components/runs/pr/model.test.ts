import type { GitHubConnectionContract, PullRequestContract } from "@otomat/domain";
import { pullRequestAcceptedSubmission, pullRequestViewModel } from "@web/components/runs/pr/model";
import { describe, expect, it } from "vitest";

const connected: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  error_code: null,
  error_message: null,
};

function pullRequest(overrides: Partial<PullRequestContract> = {}): PullRequestContract {
  return {
    id: "pr1",
    run_id: "run1",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "Ship it",
    body: null,
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    has_unpublished_changes: false,
    ...overrides,
  };
}

describe("pullRequestViewModel", () => {
  it("asks the user to connect before publication", () => {
    const model = pullRequestViewModel(
      {
        status: "disconnected",
        login: null,
        error_code: "github_auth_required",
        error_message: "Sign in to GitHub to continue.",
      },
      null,
    );

    expect(model).toMatchObject({
      connectionLabel: "GitHub not connected",
      showConnect: true,
      actionDisabled: true,
    });
  });

  it("does not claim a run is ready before it reaches review-ready", () => {
    expect(pullRequestViewModel(connected, null, false)).toMatchObject({
      actionDisabled: true,
      stateLabel: "Run not ready for publication",
    });
  });

  it.each([
    ["pushing", "Pushing branch…"],
    ["creating", "Creating pull request…"],
  ] as const)("renders honest %s progress", (publicationStatus, actionLabel) => {
    expect(
      pullRequestViewModel(connected, pullRequest({ publication_status: publicationStatus })),
    ).toMatchObject({ actionLabel, actionPending: true });
  });

  it("offers the real link and Update PR only for unpublished changes", () => {
    const row = pullRequest({
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
      has_unpublished_changes: true,
    });

    expect(pullRequestViewModel(connected, row)).toMatchObject({
      actionLabel: "Update PR",
      stateLabel: "Unpublished changes",
      linkLabel: "Open PR #42",
      linkUrl: row.url,
    });
    expect(
      pullRequestViewModel(connected, { ...row, has_unpublished_changes: false }),
    ).toMatchObject({ stateLabel: "Up to date" });
    expect(
      pullRequestViewModel(connected, { ...row, has_unpublished_changes: false }, true, true),
    ).toMatchObject({
      actionLabel: "Update PR",
      stateLabel: "Unpublished changes",
    });
  });

  it("keeps a provider link visible when the latest update failed", () => {
    const model = pullRequestViewModel(
      connected,
      pullRequest({
        number: 42,
        url: "https://github.com/acme/otomat/pull/42",
        status: "open",
        publication_status: "failed",
        error_code: "github_push_failed",
        error_message: "The run branch could not be pushed to GitHub.",
      }),
    );

    expect(model).toMatchObject({
      stateLabel: "Update failed",
      errorMessage: "The run branch could not be pushed to GitHub.",
      linkLabel: "Open PR #42",
    });
  });

  it("disables an existing pull request when the run is not review-ready", () => {
    expect(
      pullRequestViewModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status: "open",
          publication_status: "created",
          has_unpublished_changes: true,
        }),
        false,
      ),
    ).toMatchObject({ actionLabel: "Update PR", actionDisabled: true });
  });

  it("does not claim the PR is up to date when git comparison is unavailable", () => {
    expect(
      pullRequestViewModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status: "open",
          publication_status: "created",
          has_unpublished_changes: null,
        }),
      ),
    ).toMatchObject({
      actionLabel: "Retry comparison",
      stateLabel: "Changes unavailable",
    });
  });

  it.each(["merged", "closed"] as const)("makes a %s PR terminal", (status) => {
    expect(
      pullRequestViewModel(
        connected,
        pullRequest({
          number: 42,
          url: "https://github.com/acme/otomat/pull/42",
          status,
          publication_status: "created",
        }),
      ),
    ).toMatchObject({ actionDisabled: true, stateLabel: `PR ${status}` });
  });
});

describe("pullRequestAcceptedSubmission", () => {
  it("rejects a failed result that retained older metadata", () => {
    expect(
      pullRequestAcceptedSubmission(
        pullRequest({
          publication_status: "failed",
          title: "Old title",
          body: "Old body",
        }),
        { title: "New title", body: "New body" },
      ),
    ).toBe(false);
  });

  it("accepts normalized empty body metadata", () => {
    expect(
      pullRequestAcceptedSubmission(pullRequest({ title: "Ship it", body: null }), {
        title: "Ship it",
        body: "",
      }),
    ).toBe(true);
  });
});
